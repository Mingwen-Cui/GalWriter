// WebGPU 轻量级合成渲染器
// 优化场景：视频背景 + 文字覆盖层

const VERTEX_SHADER = `
  @vertex
  fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>(-1.0,  1.0),
      vec2<f32>(-1.0,  1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>( 1.0,  1.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  @group(0) @binding(0) var bgSampler: sampler;
  @group(0) @binding(1) var bgTexture: texture_2d<f32>;
  @group(0) @binding(2) var textSampler: sampler;
  @group(0) @binding(3) var textTexture: texture_2d<f32>;

  @fragment
  fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = fragCoord.xy / vec2<f32>(textureDimensions(bgTexture));
    let bg = textureSample(bgTexture, bgSampler, uv);
    let text = textureSample(textTexture, textSampler, uv);
    // 文字层 alpha 混合
    return mix(bg, text, text.a);
  }
`;

export type WebGPUContext = {
  device: GPUDevice;
  queue: GPUQueue;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  width: number;
  height: number;
};

let cachedContext: WebGPUContext | null = null;

export async function initWebGPU(width: number, height: number): Promise<WebGPUContext | null> {
  if (cachedContext && cachedContext.width === width && cachedContext.height === height) {
    return cachedContext;
  }

  if (!navigator.gpu) {
    console.warn('[WebGPU] navigator.gpu not available');
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) {
    console.warn('[WebGPU] No GPU adapter found');
    return null;
  }

  const device = await adapter.requestDevice();
  if (!device) {
    console.warn('[WebGPU] Failed to request GPU device');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('webgpu');
  if (!context) {
    console.warn('[WebGPU] Failed to get webgpu context');
    return null;
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  });

  const shaderModule = device.createShaderModule({
    code: VERTEX_SHADER + FRAGMENT_SHADER,
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: shaderModule, entryPoint: 'main' },
    fragment: {
      module: shaderModule,
      entryPoint: 'main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  cachedContext = {
    device,
    queue: device.queue,
    canvas,
    context,
    format,
    pipeline,
    bindGroupLayout,
    sampler,
    width,
    height,
  };

  return cachedContext;
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function getWebGPUCanvas(): HTMLCanvasElement | null {
  return cachedContext?.canvas ?? null;
}

export function resizeWebGPU(width: number, height: number): boolean {
  if (!cachedContext) return false;
  cachedContext.canvas.width = width;
  cachedContext.canvas.height = height;
  cachedContext.width = width;
  cachedContext.height = height;
  cachedContext.context.configure({
    device: cachedContext.device,
    format: cachedContext.format,
    alphaMode: 'opaque',
  });
  return true;
}

export function destroyWebGPU(): void {
  if (cachedContext) {
    cachedContext.context.unconfigure();
    cachedContext = null;
  }
}

// 将 HTMLVideoElement 或 ImageBitmap 导入为 GPU texture
export async function importVideoFrameToTexture(
  gpu: WebGPUContext,
  source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
): Promise<GPUTexture> {
  const texture = gpu.device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  gpu.device.queue.copyExternalImageToTexture({ source: source as HTMLVideoElement }, { texture }, [
    width,
    height,
  ]);

  return texture;
}

// 将 canvas/ImageBitmap 导入为 GPU texture
export function importCanvasToTexture(
  gpu: WebGPUContext,
  source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
  width: number,
  height: number,
): GPUTexture {
  const texture = gpu.device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  gpu.device.queue.copyExternalImageToTexture(
    { source: source as HTMLCanvasElement },
    { texture },
    [width, height],
  );

  return texture;
}

// 渲染一帧：背景 + 文字层合成
export function renderCompositeFrame(
  gpu: WebGPUContext,
  bgTexture: GPUTexture,
  textTexture: GPUTexture | null,
): void {
  const commandEncoder = gpu.device.createCommandEncoder();
  const canvasTexture = gpu.context.getCurrentTexture();

  // 创建纯黑背景（当没有视频时）
  const dummyBgTexture =
    textTexture && !bgTexture
      ? createColorTexture(gpu, [0.067, 0.086, 0.149, 1.0]) // #111827
      : bgTexture;

  const effectiveBg = dummyBgTexture || bgTexture;
  if (!effectiveBg) return;

  const bgView = effectiveBg.createView();
  const textView = textTexture
    ? textTexture.createView()
    : createColorTexture(gpu, [0, 0, 0, 0]).createView();

  const bindGroup = gpu.device.createBindGroup({
    layout: gpu.bindGroupLayout,
    entries: [
      { binding: 0, resource: gpu.sampler },
      { binding: 1, resource: bgView },
      { binding: 2, resource: gpu.sampler },
      { binding: 3, resource: textView },
    ],
  });

  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: canvasTexture.createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      },
    ],
  });

  renderPass.setPipeline(gpu.pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(6);
  renderPass.end();

  gpu.device.queue.submit([commandEncoder.finish()]);
}

function createColorTexture(
  gpu: WebGPUContext,
  color: [number, number, number, number],
): GPUTexture {
  const size = 1;
  const data = new Uint8Array([
    Math.round(color[0] * 255),
    Math.round(color[1] * 255),
    Math.round(color[2] * 255),
    Math.round(color[3] * 255),
  ]);

  const texture = gpu.device.createTexture({
    size: [size, size],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  gpu.device.queue.writeTexture({ texture }, data, { bytesPerRow: 4 * size }, [size, size]);

  return texture;
}
