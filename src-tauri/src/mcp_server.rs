use std::{
  collections::HashMap,
  net::TcpListener,
  sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
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
  handler::server::wrapper::Parameters,
  model::{CallToolResult, ContentBlock},
  schemars::{self, JsonSchema},
  tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler,
  transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
  },
};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

const MCP_BIND_ADDRESS: &str = "127.0.0.1:38941";
const MCP_ENDPOINT: &str = "http://127.0.0.1:38941/mcp";
const MAX_PROJECT_STATE_BYTES: usize = 20 * 1024 * 1024;
static NEXT_WRITE_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Default, Clone)]
pub struct GalWriterMcpState {
  project: Arc<RwLock<Option<Value>>>,
  running: Arc<AtomicBool>,
  last_request_at: Arc<RwLock<Option<String>>>,
  pending_writes: Arc<tokio::sync::Mutex<HashMap<String, tokio::sync::oneshot::Sender<Result<Value, String>>>>>,
  write_lock: Arc<tokio::sync::Mutex<()>>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct McpWriteRequest {
  request_id: String,
  operation: String,
  project_id: Option<String>,
  input: Value,
}

#[tauri::command]
pub async fn resolve_galwriter_mcp_write(
  state: State<'_, GalWriterMcpState>,
  request_id: String,
  result: Option<Value>,
  error: Option<String>,
  project: Option<Value>,
) -> Result<(), String> {
  if let Some(ref project) = project {
    let encoded = serde_json::to_vec(&project).map_err(|error| error.to_string())?;
    if encoded.len() > MAX_PROJECT_STATE_BYTES
      || !project.get("nodes").is_some_and(Value::is_array)
      || !project.get("edges").is_some_and(Value::is_array)
    {
      return Err("The editor returned an invalid or oversized project snapshot.".to_string());
    }
  }

  let pending = state.pending_writes.lock().await.remove(&request_id);
  let Some(sender) = pending else {
    return Err("The MCP write request expired or was already resolved.".to_string());
  };
  if let Some(project) = project {
    *state.project.write().unwrap_or_else(|poisoned| poisoned.into_inner()) =
      Some(sanitize_private_and_media_fields(project));
  }
  let response = match error {
    Some(error) => Err(error),
    None => result.ok_or_else(|| "The editor returned no write result.".to_string()),
  };
  sender.send(response).map_err(|_| "The MCP client cancelled this write request.".to_string())
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
    "api_key", "api-key", "apikey", "secret", "token", "password", "base64", "dataurl", "thumbnail",
    "image", "audio", "video", "media", "blob", "avatar", "threeview", "tag_sprite", "tagsprite",
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

#[allow(dead_code)]
#[derive(Clone)]
struct GalWriterMcpServer {
  state: GalWriterMcpState,
  app: AppHandle,
  tool_router: ToolRouter<Self>,
}

#[tool_router]
impl GalWriterMcpServer {
  fn new(state: GalWriterMcpState, app: AppHandle) -> Self {
    Self {
      state,
      app,
      tool_router: Self::tool_router(),
    }
  }

  async fn request_editor_write(&self, operation: &str, input: Value) -> Result<Value, McpError> {
    let _write_guard = self.state.write_lock.lock().await;
    let project_id = self.state.project.read().unwrap_or_else(|error| error.into_inner())
      .as_ref()
      .and_then(|project| project.get("projectId"))
      .and_then(Value::as_str)
      .map(str::to_string);
    if self.state.project.read().unwrap_or_else(|error| error.into_inner()).is_none() {
      return Err(McpError::internal_error(
        "No active editor project is available for writing.".to_string(),
        None,
      ));
    }

    let request_id = format!("mcp-{}-{}-{}", timestamp_now(), std::process::id(), NEXT_WRITE_ID.fetch_add(1, Ordering::Relaxed));
    let (sender, receiver) = tokio::sync::oneshot::channel();
    self.state.pending_writes.lock().await.insert(request_id.clone(), sender);
    if let Err(error) = self.app.emit("galwriter-mcp-write-request", McpWriteRequest {
      request_id: request_id.clone(),
      operation: operation.to_string(),
      project_id,
      input,
    }) {
      self.state.pending_writes.lock().await.remove(&request_id);
      return Err(McpError::internal_error(format!("Could not deliver write request to the editor: {error}"), None));
    }

    let timeout = std::time::Duration::from_secs(if matches!(operation, "generate_project_node_image" | "capture_playtest_screen" | "capture_editor_canvas") { 180 } else { 20 });
    match tokio::time::timeout(timeout, receiver).await {
      Ok(Ok(Ok(result))) => {
        *self.state.last_request_at.write().unwrap_or_else(|error| error.into_inner()) = Some(timestamp_now());
        Ok(result)
      }
      Ok(Ok(Err(error))) => Err(McpError::invalid_params(error, None)),
      Ok(Err(_)) => Err(McpError::internal_error("The editor closed before confirming the write.".to_string(), None)),
        Err(_) => {
          self.state.pending_writes.lock().await.remove(&request_id);
        Err(McpError::internal_error(format!("The editor did not confirm the write within {} seconds.", timeout.as_secs()), None))
      }
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

  #[tool(description = "List story, character, scene, and plot-structure cards in the currently open GalWriter project without returning full story text. The isRoot field identifies the protected root story card.")]
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
          "isRoot": data.get("isRoot"),
          "data": {
            "title": data.get("title"),
            "characterName": data.get("characterName"),
            "identity": data.get("identity"),
            "appearance": data.get("appearance"),
            "traits": data.get("traits"),
            "personality": data.get("personality"),
            "sceneName": data.get("sceneName"),
            "description": data.get("description"),
            "location": data.get("location"),
            "chapterTitle": data.get("chapterTitle"),
            "creationMode": data.get("creationMode"),
            "cardCount": data.get("cardCount"),
            "detailLevel": data.get("detailLevel"),
            "direction": data.get("direction"),
            "choiceInterval": data.get("choiceInterval"),
            "prefetchCount": data.get("prefetchCount"),
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

  #[tool(description = "List reusable media asset IDs and names without exposing file paths, URLs, or binary payloads.")]
  async fn list_project_assets(&self) -> Result<CallToolResult, McpError> {
    let project = self.state.project.read().unwrap_or_else(|error| error.into_inner()).clone();
    let Some(project) = project else {
      return Err(McpError::internal_error("No active editor project is available.".to_string(), None));
    };
    let result = json!({
      "projectId": project.get("projectId"),
      "assets": project.get("assetCatalog").and_then(Value::as_array).cloned().unwrap_or_default(),
    });
    let text = serde_json::to_string_pretty(&result).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
  }

  #[tool(description = "Open the GalWriter playtest UI in fullscreen or windowed mode. Defaults to fullscreen.")]
  async fn open_playtest(&self, Parameters(input): Parameters<OpenPlaytestInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("open_playtest", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Read current playtest runtime settings, canvas settings, and safe render-object styling so you can inspect the game interface before editing it.")]
  async fn get_playtest_configuration(&self) -> Result<CallToolResult, McpError> {
    let result = self.request_editor_write("get_playtest_configuration", json!({})).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Update validated playtest parameters. patch is {runtime?: {darkMode?, choicesColumns?, interactionMode?, typewriterSpeed?, choiceDelay?, blurBackground?, blurText?, dimBackground?, autoAdvance?, autoAdvanceDelay?, videoAutoPlay?, hideCharacterTags?, hideSceneTags?, skipSingleChoicePopup?, layoutMode?, choicesPosition?}, canvas?: {canvasWidth?, canvasHeight?, canvasRatioWidth?, canvasRatioHeight?, canvasRatioLocked?, layoutMode?, sceneFit?, sceneScale?, sceneScaleX?, sceneScaleY?, sceneOffsetX?, sceneOffsetY?, sceneBackgroundVisible?, sceneBackgroundType?, sceneBackgroundColor?, sceneBackgroundGradientStart?, sceneBackgroundGradientEnd?, sceneBackgroundGradientAngle?, choicesPosition?, skipSingleChoicePopup?, autoAdvance?, videoAutoPlay?, hideCharacterTags?, hideSceneTags?}}. Numeric values and enums are range-checked; media URLs and credentials are not accepted.")]
  async fn update_playtest_settings(&self, Parameters(input): Parameters<UpdatePlaytestSettingsInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_playtest_settings", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Update one playtest object: dialogBox, title, body, nameplate, or choice. fields accepts validated position/size/layer/visibility/text settings and fill, stroke, shadow, or shadows patches. Image URLs, arbitrary CSS, and credential fields are rejected.")]
  async fn update_playtest_render_object(&self, Parameters(input): Parameters<UpdatePlaytestRenderObjectInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_playtest_render_object", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Capture the current playtest game stage as a PNG and return it as an MCP image block for visual evaluation. Open the playtest first. Settings panels are excluded.")]
  async fn capture_playtest_screen(&self) -> Result<CallToolResult, McpError> {
    let result = self.request_editor_write("capture_playtest_screen", json!({})).await?;
    let image_data = result.get("imageData").and_then(Value::as_str)
      .ok_or_else(|| McpError::internal_error("The editor returned no playtest screenshot.", None))?;
    if image_data.len() > 8 * 1024 * 1024 {
      return Err(McpError::internal_error("The playtest screenshot is larger than the 8 MB limit.", None));
    }
    let mime_type = result.get("mimeType").and_then(Value::as_str).unwrap_or("image/png");
    Ok(CallToolResult::success(vec![
      ContentBlock::text("Current GalWriter playtest screenshot."),
      ContentBlock::image(image_data, mime_type),
    ]))
  }

  #[tool(description = "Capture the currently visible story editor canvas as a PNG, including cards, links, and background regions. Use this to inspect the user's canvas layout before or after arranging cards. The screenshot reflects the current viewport.")]
  async fn capture_editor_canvas(&self) -> Result<CallToolResult, McpError> {
    let result = self.request_editor_write("capture_editor_canvas", json!({})).await?;
    let image_data = result.get("imageData").and_then(Value::as_str)
      .ok_or_else(|| McpError::internal_error("The editor returned no canvas screenshot.", None))?;
    if image_data.len() > 8 * 1024 * 1024 {
      return Err(McpError::internal_error("The editor screenshot is larger than the 8 MB limit.", None));
    }
    let mime_type = result.get("mimeType").and_then(Value::as_str).unwrap_or("image/png");
    Ok(CallToolResult::success(vec![
      ContentBlock::text("Current GalWriter story editor canvas screenshot."),
      ContentBlock::image(image_data, mime_type),
    ]))
  }

  #[tool(description = "Update the title and/or body text of an existing story card. Only title and text fields can be changed.")]
  async fn update_story_node(&self, Parameters(input): Parameters<UpdateStoryNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_story_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Create a story card at a rough canvas anchor. Optional layout_direction ('up', 'down', 'left', 'right') sets the story-flow direction. In a multi-card apply_story_changes batch, the editor positions story, character, and scene cards into type groups, adds fitting background cards, and computes connection handles from final geometry. Use capture_editor_canvas to inspect the user's viewport and move_story_node to refine placement.")]
  async fn create_story_node(&self, Parameters(input): Parameters<CreateStoryNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("create_story_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Connect two existing story cards with a directed link. Duplicate and self-links are rejected.")]
  async fn connect_story_nodes(&self, Parameters(input): Parameters<ConnectStoryNodesInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("connect_story_nodes", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Delete an existing story card and its connected links. The root story card cannot be deleted.")]
  async fn delete_story_node(&self, Parameters(input): Parameters<StoryNodeIdInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("delete_story_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Delete an existing non-root story, character, scene, or plot-structure card and its connected links. The protected root story card must be updated to the new story's first card instead of deleted.")]
  async fn delete_project_node(&self, Parameters(input): Parameters<StoryNodeIdInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("delete_project_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Move an existing canvas node to an absolute canvas position.")]
  async fn move_story_node(&self, Parameters(input): Parameters<MoveStoryNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("move_story_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Remove directed links between two existing story cards.")]
  async fn disconnect_story_nodes(&self, Parameters(input): Parameters<ConnectStoryNodesInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("disconnect_story_nodes", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Update safe text and display fields on an existing story, character, or scene card. Fields are validated against the card type.")]
  async fn update_project_node(&self, Parameters(input): Parameters<UpdateProjectNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_project_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Edit an existing character setting card. Writable fields: characterName, identity, appearance, traits, personality, habits, speechStyle, experience, relationships, notes, features, background, other, isGlobal, showPersonality, showFeatures, showBackground, showOther. Use camelCase field names from the project.")]
  async fn update_character_node(&self, Parameters(input): Parameters<UpdateCharacterNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_character_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Edit an existing scene setting card. Writable fields: sceneName, description, location, items, atmosphere, time, weather, visual, sound, notes, other, isGlobal, showLocation, showItems, showAtmosphere, showOther, scenePresetEnabled, sceneEnvironment, visualStyle. Use camelCase field names from the project.")]
  async fn update_scene_node(&self, Parameters(input): Parameters<UpdateSceneNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_scene_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Edit an existing plot-structure card. Writable fields: creationMode ('continue' or 'play'), cardCount (integer 1-20), detailLevel ('brief', 'standard', or 'detailed'), direction (string), choiceInterval (integer 1-12), prefetchCount (integer 1-3), and isMinimized (boolean). Use camelCase field names from the project.")]
  async fn update_plot_structure_node(&self, Parameters(input): Parameters<UpdatePlotStructureNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("update_plot_structure_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Replace story-card dialogue with validated text segments. To add a character or scene tag, include a {type: mention, node_id, kind} segment referencing an existing characterNode or sceneNode; this creates a real editable mention chip and synchronizes its presentation association.")]
  async fn set_story_text(&self, Parameters(input): Parameters<SetStoryTextInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("set_story_text", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Set validated scene, character, and inline-action presentation data on an existing story card.")]
  async fn set_story_presentation(&self, Parameters(input): Parameters<SetStoryPresentationInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("set_story_presentation", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Create a character card at a rough canvas anchor. Optional layout_direction applies when this is part of a multi-card apply_story_changes batch. Use capture_editor_canvas to inspect the user's viewport and move_story_node to refine placement.")]
  async fn create_character_node(&self, Parameters(input): Parameters<CreateCharacterNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("create_character_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Create a scene card at a rough canvas anchor. Optional layout_direction applies when this is part of a multi-card apply_story_changes batch. Use capture_editor_canvas to inspect the user's viewport and move_story_node to refine placement.")]
  async fn create_scene_node(&self, Parameters(input): Parameters<CreateSceneNodeInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("create_scene_node", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Assign an existing project media asset to a compatible story, character, or scene card field without accepting arbitrary paths or URLs.")]
  async fn set_story_media(&self, Parameters(input): Parameters<SetStoryMediaInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("set_story_media", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Clear a supported image, video, or audio reference from a story, character, or scene card.")]
  async fn clear_story_media(&self, Parameters(input): Parameters<ClearStoryMediaInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("clear_story_media", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Generate one image with the Image AI profile already configured in the open editor, then attach it to the specified character or scene card. asset_type must be portrait, three-view, tag-sprite, or background. API credentials stay in the editor and are never part of this tool input or result.")]
  async fn generate_project_node_image(&self, Parameters(input): Parameters<GenerateProjectNodeImageInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("generate_project_node_image", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Validate a list of supported story and setting-card edits, including deletion of non-root story, character, scene, and plot-structure cards, and return a preview without changing the project.")]
  async fn preview_story_changes(&self, Parameters(input): Parameters<StoryChangesInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("preview_story_changes", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Apply a validated list of supported story and setting-card edits as one undoable change. Optional layout_direction ('up', 'down', 'left', 'right') controls the story-flow layout for newly created cards. Multi-card creation groups story, character, and scene cards and creates fitting background regions. Use preview_story_changes first for a dry run.")]
  async fn apply_story_changes(&self, Parameters(input): Parameters<StoryChangesInput>) -> Result<CallToolResult, McpError> {
    let input = serde_json::to_value(input).map_err(|error| McpError::internal_error(error.to_string(), None))?;
    let result = self.request_editor_write("apply_story_changes", input).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Save the current editor snapshot to GalWriter's local project storage and wait for confirmation.")]
  async fn save_current_project(&self) -> Result<CallToolResult, McpError> {
    let result = self.request_editor_write("save_current_project", json!({})).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }

  #[tool(description = "Export the current editor snapshot as a GalWriter ZIP project and wait for the user to complete or cancel the save dialog.")]
  async fn export_current_project(&self) -> Result<CallToolResult, McpError> {
    let result = self.request_editor_write("export_current_project", json!({})).await?;
    Ok(CallToolResult::success(vec![ContentBlock::text(result.to_string())]))
  }
}

#[tool_handler(name = "galwriter", version = "1.5.0", instructions = "Read the current GalWriter desktop project before editing. Use set_story_text mention segments with existing characterNode/sceneNode IDs to add real editable tags; those tags synchronize presentation associations. Edit character, scene, or plot-structure settings with their typed update tools. When the user asks for a new, unrelated story, replace the existing little-monk/old-monk demo story instead of keeping it: update the protected root story card so it becomes the first card of the new story, then delete the obsolete non-root story cards and their related old character, scene, and plot-structure cards with delete_project_node. Do not delete the root card. Do not perform this cleanup for a continuation or revision of the current story. Create and connect the new story cards as requested. For visual card layout, call capture_editor_canvas to inspect the user's current canvas before and after arranging cards, then use move_story_node to refine positions. Connection handles are selected by the editor from card geometry; do not try to calculate handle IDs. When the user asks for a character portrait, three-view sheet, transparent full-body sprite, or scene background image, use generate_project_node_image with the matching asset_type on the corresponding card. The editor uses its locally configured Image AI profile; never ask for, read, include, or reveal API keys in MCP arguments or responses. For playtest work, call get_playtest_configuration to inspect settings, use update_playtest_settings and update_playtest_render_object for validated interface changes, open_playtest to show the game, and capture_playtest_screen to return the game stage as an image for visual evaluation. For multi-step story edits, preview_story_changes first, then apply_story_changes. Changes are applied through the open editor as undoable edits; call save_current_project when persistence is requested.")]
impl ServerHandler for GalWriterMcpServer {}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdateStoryNodeInput {
  node_id: String,
  fields: std::collections::BTreeMap<String, Value>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct CreateStoryNodeInput {
  title: String,
  text: String,
  position: StoryNodePosition,
  layout_direction: Option<StoryLayoutDirection>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct StoryNodePosition {
  x: f64,
  y: f64,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
enum StoryLayoutDirection {
  Up,
  Down,
  Left,
  Right,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct ConnectStoryNodesInput {
  source_id: String,
  target_id: String,
  label: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct StoryNodeIdInput {
  node_id: String,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct MoveStoryNodeInput {
  node_id: String,
  position: StoryNodePosition,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdateProjectNodeInput {
  node_id: String,
  fields: std::collections::BTreeMap<String, Value>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdateCharacterNodeInput {
  node_id: String,
  fields: std::collections::BTreeMap<String, Value>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdateSceneNodeInput {
  node_id: String,
  fields: std::collections::BTreeMap<String, Value>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdatePlotStructureNodeInput {
  node_id: String,
  fields: std::collections::BTreeMap<String, Value>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct CreateCharacterNodeInput {
  character_name: String,
  position: StoryNodePosition,
  layout_direction: Option<StoryLayoutDirection>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct CreateSceneNodeInput {
  scene_name: String,
  position: StoryNodePosition,
  layout_direction: Option<StoryLayoutDirection>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct SetStoryMediaInput {
  node_id: String,
  field: String,
  asset_id: String,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct ClearStoryMediaInput {
  node_id: String,
  field: String,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
enum ProjectImageAssetType {
  Portrait,
  ThreeView,
  TagSprite,
  Background,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct GenerateProjectNodeImageInput {
  node_id: String,
  asset_type: ProjectImageAssetType,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct SetStoryTextInput {
  node_id: String,
  segments: Vec<StoryTextSegment>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct SetStoryPresentationInput {
  node_id: String,
  presentation: Value,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct StoryChangesInput {
  operations: Vec<StoryChangeOperation>,
  layout_direction: Option<StoryLayoutDirection>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct OpenPlaytestInput {
  display_mode: Option<PlaytestDisplayMode>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
enum PlaytestDisplayMode {
  Fullscreen,
  Windowed,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdatePlaytestSettingsInput {
  patch: Value,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
struct UpdatePlaytestRenderObjectInput {
  object_id: String,
  fields: std::collections::BTreeMap<String, Value>,
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
enum StoryChangeOperation {
  UpdateNode { node_id: String, fields: std::collections::BTreeMap<String, Value> },
  SetTextSegments { node_id: String, segments: Vec<StoryTextSegment> },
  SetPresentation { node_id: String, presentation: Value },
  SetMedia { node_id: String, field: String, asset_id: String },
  ClearMedia { node_id: String, field: String },
  CreateStoryNode { node_id: Option<String>, title: String, text: String, position: StoryNodePosition },
  CreateCharacterNode { node_id: Option<String>, character_name: String, position: StoryNodePosition },
  CreateSceneNode { node_id: Option<String>, scene_name: String, position: StoryNodePosition },
  DeleteStoryNode { node_id: String },
  DeleteProjectNode { node_id: String },
  MoveNode { node_id: String, position: StoryNodePosition },
  ConnectStoryNodes { source_id: String, target_id: String, label: Option<String> },
  DisconnectStoryNodes { source_id: String, target_id: String },
}

#[derive(serde::Deserialize, serde::Serialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
enum StoryTextSegment {
  Text { text: String, format: Option<String> },
  Mention { node_id: String, kind: String },
}

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
  let origin = request.headers().get("origin").and_then(|value| value.to_str().ok());
  if let Some(origin) = origin {
    let origin = origin.trim_end_matches('/').to_ascii_lowercase();
    if !matches!(origin.as_str(), "tauri://localhost" | "http://tauri.localhost" | "https://tauri.localhost" | "http://localhost:3000" | "http://127.0.0.1:3000") {
      return StatusCode::FORBIDDEN.into_response();
    }
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
  let server_app = app.clone();
  let mcp_service = StreamableHttpService::new(
    move || Ok(GalWriterMcpServer::new(state.clone(), server_app.clone())),
    LocalSessionManager::default().into(),
    StreamableHttpServerConfig::default()
      .with_legacy_session_mode(false)
      .with_json_response(true),
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
