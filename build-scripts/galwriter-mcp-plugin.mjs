import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const MCP_PATH = '/mcp';
const STATUS_PATH = '/__galwriter/mcp/status';
const PROJECT_STATE_PATH = '/__galwriter/mcp/project-state';
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_PROJECT_STATE_BYTES = 20 * 1024 * 1024;

const readJsonBody = async (request, maxBytes = MAX_PROJECT_STATE_BYTES) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const writeJson = (response, statusCode, value) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
};

const isLocalRequest = (request) => {
  const host = String(request.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return false;

  const origin = request.headers.origin;
  if (!origin) return true;

  try {
    return ALLOWED_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
};

const removePrivateAndMediaFields = (value, depth = 0) => {
  if (depth > 12) return '[truncated]';
  if (typeof value === 'string') return value.length > 20_000 ? `${value.slice(0, 20_000)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => removePrivateAndMediaFields(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(api.?key|secret|token|password|base64|dataurl|thumbnail|image|audio|video|media|blob)/i.test(key))
      .map(([key, item]) => [key, removePrivateAndMediaFields(item, depth + 1)]),
  );
};

const getProjectPayload = (state) => {
  if (!state.project) return null;
  return {
    projectId: state.project.projectId,
    projectTitle: state.project.projectTitle,
    updatedAt: state.project.updatedAt,
    nodes: state.project.nodes,
    edges: state.project.edges,
  };
};

const getConnectionStatus = (state) => {
  const project = state.project;
  return {
    service: 'GalWriter MCP',
    transport: 'Streamable HTTP',
    endpoint: 'http://127.0.0.1:3000/mcp',
    serverAvailable: true,
    projectSyncedAt: project?.updatedAt ?? null,
    projectAvailable: Boolean(project && (project.projectId || project.projectTitle || project.nodes.length)),
    projectTitle: project?.projectTitle || null,
    nodeCount: project?.nodes.length ?? 0,
    edgeCount: project?.edges.length ?? 0,
    lastMcpRequestAt: state.lastMcpRequestAt,
  };
};

const createMcpServer = (state) => {
  const server = new McpServer({ name: 'galwriter', version: '1.0.0' });

  server.registerTool(
    'get_connection_status',
    {
      title: 'GalWriter connection status',
      description: 'Check whether the local GalWriter MCP bridge is running and whether an editor project is available.',
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(getConnectionStatus(state), null, 2) }],
      structuredContent: getConnectionStatus(state),
    }),
  );

  server.registerTool(
    'get_current_project',
    {
      title: 'Read current GalWriter project',
      description: 'Read the currently open GalWriter project as story nodes and links. API profiles, credentials, and media payloads are excluded.',
    },
    async () => {
      const project = getProjectPayload(state);
      if (!project) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'No project state has been shared by an open GalWriter editor yet.' }],
        };
      }

      const safeProject = removePrivateAndMediaFields(project);
      return {
        content: [{ type: 'text', text: JSON.stringify(safeProject) }],
        structuredContent: safeProject,
      };
    },
  );

  server.registerTool(
    'list_project_cards',
    {
      title: 'List GalWriter project cards',
      description: 'List the story cards in the currently open project without returning their full text.',
    },
    async () => {
      const project = getProjectPayload(state);
      if (!project) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'No project state has been shared by an open GalWriter editor yet.' }],
        };
      }

      const cards = project.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          title: node.data?.title,
          characterName: node.data?.characterName,
          sceneName: node.data?.sceneName,
          chapterTitle: node.data?.chapterTitle,
        },
      }));
      const result = {
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        count: cards.length,
        cards,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerResource(
    'current-project',
    'galwriter://current-project',
    {
      title: 'Current GalWriter project',
      description: 'The currently open GalWriter project, excluding API profiles, credentials, and media payloads.',
      mimeType: 'application/json',
    },
    async () => {
      const project = getProjectPayload(state);
      if (!project) throw new Error('No project state has been shared by an open GalWriter editor yet.');
      return {
        contents: [{
          uri: 'galwriter://current-project',
          mimeType: 'application/json',
          text: JSON.stringify(removePrivateAndMediaFields(project)),
        }],
      };
    },
  );

  return server;
};

export const galWriterMcpPlugin = () => {
  const state = { project: null, lastMcpRequestAt: null };

  return {
    name: 'galwriter-local-mcp',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname;
        if (![MCP_PATH, STATUS_PATH, PROJECT_STATE_PATH].includes(pathname)) return next();

        if (!isLocalRequest(request)) {
          writeJson(response, 403, { error: 'GalWriter MCP only accepts local requests.' });
          return;
        }

        if (pathname === STATUS_PATH) {
          if (request.method !== 'GET') {
            response.setHeader('Allow', 'GET');
            writeJson(response, 405, { error: 'Method not allowed.' });
            return;
          }
          writeJson(response, 200, getConnectionStatus(state));
          return;
        }

        if (pathname === PROJECT_STATE_PATH) {
          if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST');
            writeJson(response, 405, { error: 'Method not allowed.' });
            return;
          }
          try {
            const project = await readJsonBody(request);
            if (!project || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) {
              writeJson(response, 400, { error: 'Invalid project state.' });
              return;
            }
            state.project = {
              projectId: typeof project.projectId === 'string' ? project.projectId : null,
              projectTitle: typeof project.projectTitle === 'string' ? project.projectTitle.slice(0, 500) : '',
              updatedAt: new Date().toISOString(),
              nodes: project.nodes,
              edges: project.edges,
            };
            writeJson(response, 204, {});
          } catch (error) {
            writeJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }

        if (request.method !== 'POST') {
          response.setHeader('Allow', 'POST');
          writeJson(response, 405, { error: 'MCP Streamable HTTP uses POST requests.' });
          return;
        }

        try {
          const body = await readJsonBody(request);
          state.lastMcpRequestAt = new Date().toISOString();
          const mcpServer = createMcpServer(state);
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          });
          await mcpServer.connect(transport);
          response.on('close', () => {
            void transport.close();
            void mcpServer.close();
          });
          await transport.handleRequest(request, response, body);
        } catch (error) {
          if (!response.headersSent) {
            writeJson(response, 500, {
              jsonrpc: '2.0',
              error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
              id: null,
            });
          }
        }
      });

      server.config.logger.info('GalWriter MCP endpoint available at http://127.0.0.1:3000/mcp');
    },
  };
};
