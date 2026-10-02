use std::{
  net::TcpListener,
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, RwLock,
  },
  time::{SystemTime, UNIX_EPOCH},
};

use axum::{
  body::Body,
  extract::Request,
  http::{header::HOST, StatusCode},
  middleware::{self, Next},
  response::Response,
  Router,
};
use rmcp::{
  handler::server::tool::ToolRouter,
  model::{CallToolResult, ContentBlock},
  tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler,
  ServiceExt,
  transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
  },
};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

const MCP_BIND_ADDRESS: &str = "127.0.0.1:38941";
const MCP_ENDPOINT: &str = "http://127.0.0.1:38941/mcp";
const MAX_PROJECT_STATE_BYTES: usize = 20 * 1024 * 1024;

#[derive(Default, Clone)]
pub struct GalWriterMcpState {
  project: Arc<RwLock<Option<Value>>>,
  running: Arc<AtomicBool>,
  last_request_at: Arc<RwLock<Option<String>>>,
}

#[tauri::command]
pub fn update_galwriter_mcp_project(
  state: State<'_, GalWriterMcpState>,
  project: Value,
) -> Result<(), String> {
  let encoded = serde_json::to_vec(&project).map_err(|error| error.to_string())?;
  if encoded.len() > MAX_PROJECT_STATE_BYTES {
    return Err("Project state is larger than the 20 MB limit.".to_string());
  }
  if !project.get("nodes").is_some_and(Value::is_array)
    || !project.get("edges").is_some_and(Value::is_array)
  {
    return Err("Invalid GalWriter project snapshot.".to_string());
  }

  let mut current = state.project.write().unwrap_or_else(|error| error.into_inner());
  *current = Some(sanitize_private_and_media_fields(project));
  Ok(())
}

#[tauri::command]
pub fn get_galwriter_mcp_status(state: State<'_, GalWriterMcpState>) -> Value {
  connection_status(&state)
}

fn connection_status(state: &GalWriterMcpState) -> Value {
  let project = state.project.read().unwrap_or_else(|error| error.into_inner());
  let project_available = project.as_ref().is_some_and(|project| {
    project.get("projectId").and_then(Value::as_str).is_some_and(|value| !value.is_empty())
      || project.get("projectTitle").and_then(Value::as_str).is_some_and(|value| !value.is_empty())
      || project.get("nodes").and_then(Value::as_array).is_some_and(|nodes| !nodes.is_empty())
  });
  json!({
    "service": "GalWriter MCP",
    "transport": "Streamable HTTP",
    "endpoint": MCP_ENDPOINT,
    "serverAvailable": state.running.load(Ordering::Relaxed),
    "projectAvailable": project_available,
    "projectTitle": project.as_ref().and_then(|value| value.get("projectTitle")).and_then(Value::as_str),
    "nodeCount": project.as_ref().and_then(|value| value.get("nodes")).and_then(Value::as_array).map_or(0, Vec::len),
    "edgeCount": project.as_ref().and_then(|value| value.get("edges")).and_then(Value::as_array).map_or(0, Vec::len),
    "projectSyncedAt": project.as_ref().and_then(|value| value.get("updatedAt")),
    "lastMcpRequestAt": state.last_request_at.read().unwrap_or_else(|error| error.into_inner()).clone(),
  })
}

fn sanitize_private_and_media_fields(value: Value) -> Value {
  match value {
    Value::String(text) => Value::String(if text.len() > 20_000 {
      let boundary = text.char_indices().map(|(index, _)| index).take_while(|index| *index <= 20_000).last().unwrap_or(0);
      format!("{}…", &text[..boundary])
    } else {
      text
    }),
    Value::Array(values) => Value::Array(
      values
        .into_iter()
        .take(500)
        .map(sanitize_private_and_media_fields)
        .collect(),
    ),
    Value::Object(object) => Value::Object(
      object
        .into_iter()
        .filter(|(key, _)| !is_private_or_media_field(key))
        .map(|(key, value)| (key, sanitize_private_and_media_fields(value)))
        .collect(),
    ),
    other => other,
  }
}

fn is_private_or_media_field(key: &str) -> bool {
  let key = key.to_ascii_lowercase();
  [
    "api_key", "apikey", "secret", "token", "password", "base64", "dataurl", "thumbnail",
    "image", "audio", "video", "media", "blob",
  ]
  .iter()
  .any(|part| key.contains(part))
}

fn timestamp_now() -> String {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_secs().to_string())
    .unwrap_or_else(|_| "unknown".to_string())
}

#[derive(Clone)]
struct GalWriterMcpServer {
  state: GalWriterMcpState,
  tool_router: ToolRouter<Self>,
}

#[tool_router]
impl GalWriterMcpServer {
  fn new(state: GalWriterMcpState) -> Self {
    Self {
      state,
      tool_router: Self::tool_router(),
    }
  }

  #[tool(description = "Check whether the local GalWriter MCP server is running and whether an editor project is available.")]
  async fn get_connection_status(&self) -> Result<CallToolResult, McpError> {
    *self.state.last_request_at.write().unwrap_or_else(|error| error.into_inner()) =
      Some(timestamp_now());
    let status = connection_status(&self.state);
    let text = serde_json::to_string_pretty(&status)
      .map_err(|error| McpError::internal_error(error.to_string(), None))?;
    Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
  }

  #[tool(description = "Read the currently open GalWriter project as story nodes and links. Credentials and media payloads are excluded.")]
  async fn get_current_project(&self) -> Result<CallToolResult, McpError> {
    *self.state.last_request_at.write().unwrap_or_else(|error| error.into_inner()) =
      Some(timestamp_now());
    let project = self.state.project.read().unwrap_or_else(|error| error.into_inner()).clone();
    let Some(project) = project else {
      return Err(McpError::internal_error(
        "No project state has been shared by an open GalWriter editor yet.".to_string(),
        None,
      ));
    };
    let text = serde_json::to_string(&sanitize_private_and_media_fields(project))
      .map_err(|error| McpError::internal_error(error.to_string(), None))?;
    Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
  }

  #[tool(description = "List story cards in the currently open GalWriter project without returning their full text.")]
  async fn list_project_cards(&self) -> Result<CallToolResult, McpError> {
    *self.state.last_request_at.write().unwrap_or_else(|error| error.into_inner()) =
      Some(timestamp_now());
    let project = self.state.project.read().unwrap_or_else(|error| error.into_inner()).clone();
    let Some(project) = project else {
      return Err(McpError::internal_error(
        "No project state has been shared by an open GalWriter editor yet.".to_string(),
        None,
      ));
    };
    let cards: Vec<Value> = project
      .get("nodes")
      .and_then(Value::as_array)
      .into_iter()
      .flatten()
      .map(|node| {
        let data = node.get("data").unwrap_or(&Value::Null);
        json!({
          "id": node.get("id"),
          "type": node.get("type"),
          "position": node.get("position"),
          "data": {
            "title": data.get("title"),
            "characterName": data.get("characterName"),
            "sceneName": data.get("sceneName"),
            "chapterTitle": data.get("chapterTitle"),
          }
        })
      })
      .collect();
    let result = json!({
      "projectId": project.get("projectId"),
      "projectTitle": project.get("projectTitle"),
      "count": cards.len(),
      "cards": cards,
    });
    let text = serde_json::to_string_pretty(&result)
      .map_err(|error| McpError::internal_error(error.to_string(), None))?;
    Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
  }
}

#[tool_handler(name = "galwriter", version = "1.3.0", instructions = "Read the current GalWriter desktop project. All exposed tools are read-only.")]
impl ServerHandler for GalWriterMcpServer {}

async fn restrict_to_loopback_host(request: Request<Body>, next: Next) -> Response {
  let host = request
    .headers()
    .get(HOST)
    .and_then(|value| value.to_str().ok())
    .unwrap_or_default()
    .to_ascii_lowercase();
  if host != "127.0.0.1:38941" && host != "localhost:38941" {
    return StatusCode::FORBIDDEN.into_response();
  }
  next.run(request).await
}

pub fn start_galwriter_mcp_server(app: &AppHandle) -> Result<(), String> {
  let listener = TcpListener::bind(MCP_BIND_ADDRESS).map_err(|error| {
    format!("Could not start the GalWriter MCP server at {MCP_ENDPOINT}: {error}")
  })?;
  listener
    .set_nonblocking(true)
    .map_err(|error| format!("Could not configure the GalWriter MCP listener: {error}"))?;

  let state = app.state::<GalWriterMcpState>().inner().clone();
  state.running.store(true, Ordering::Relaxed);
  let mcp_service = StreamableHttpService::new(
    move || Ok(GalWriterMcpServer::new(state.clone())),
    LocalSessionManager::default().into(),
    StreamableHttpServerConfig::default().with_json_response(true),
  );
  let router = Router::new()
    .nest_service("/mcp", mcp_service)
    .layer(middleware::from_fn(restrict_to_loopback_host));
  let app_state = app.state::<GalWriterMcpState>().inner().clone();

  tauri::async_runtime::spawn(async move {
    let listener = match tokio::net::TcpListener::from_std(listener) {
      Ok(listener) => listener,
      Err(error) => {
        app_state.running.store(false, Ordering::Relaxed);
        log::error!("Failed to initialize GalWriter MCP listener: {error}");
        return;
      }
    };
    if let Err(error) = axum::serve(listener, router).await {
      app_state.running.store(false, Ordering::Relaxed);
      log::error!("GalWriter MCP server stopped: {error}");
    }
  });

  log::info!("GalWriter MCP server available at {MCP_ENDPOINT}");
  Ok(())
}

use axum::response::IntoResponse;
