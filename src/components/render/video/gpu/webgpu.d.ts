// WebGPU 类型声明（浏览器原生 API）
// 当 TypeScript lib 未包含 webgpu 时使用

declare global {
  interface Navigator {
    readonly gpu: GPU;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat(): GPUTextureFormat;
  }

  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
  }

  interface GPUAdapter {
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  }

  interface GPUDeviceDescriptor {}

  interface GPUDevice {
    readonly queue: GPUQueue;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
    createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  }

  interface GPUQueue {
    submit(commandBuffers: GPUCommandBuffer[]): void;
    writeTexture(
      destination: GPUTextureCopyDestination,
      data: BufferSource,
      dataLayout: GPUImageDataLayout,
      size: GPUExtent3D,
    ): void;
    copyExternalImageToTexture(
      source: GPUImageCopyExternalImage,
      destination: GPUImageCopyTextureTagged,
      copySize: GPUExtent3D,
    ): void;
  }

  interface GPUShaderModuleDescriptor {
    code: string;
  }

  interface GPUShaderModule {}

  interface GPUSamplerDescriptor {
    magFilter?: GPUFilterMode;
    minFilter?: GPUFilterMode;
    addressModeU?: GPUAddressMode;
    addressModeV?: GPUAddressMode;
  }

  type GPUFilterMode = 'nearest' | 'linear';
  type GPUAddressMode = 'clamp-to-edge' | 'repeat' | 'mirror-repeat';

  interface GPUSampler {}

  interface GPUBindGroupLayoutDescriptor {
    entries: GPUBindGroupLayoutEntry[];
  }

  interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: GPUShaderStageFlags;
    sampler?: GPUSamplerBindingLayout;
    texture?: GPUTextureBindingLayout;
    buffer?: GPUBufferBindingLayout;
  }

  type GPUShaderStageFlags = number;
  const GPUShaderStage: {
    readonly VERTEX: number;
    readonly FRAGMENT: number;
    readonly COMPUTE: number;
  };

  interface GPUSamplerBindingLayout {
    type?: 'filtering' | 'non-filtering' | 'comparison';
  }

  interface GPUTextureBindingLayout {
    sampleType?: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
    viewDimension?: GPUTextureViewDimension;
    multisampled?: boolean;
  }

  interface GPUBufferBindingLayout {
    type?: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
  }

  interface GPUBindGroupLayout {}

  interface GPUPipelineLayoutDescriptor {
    bindGroupLayouts: (GPUBindGroupLayout | null)[];
  }

  interface GPUPipelineLayout {}

  interface GPURenderPipelineDescriptor {
    layout: GPUPipelineLayout | 'auto';
    vertex: GPUVertexState;
    fragment?: GPUFragmentState;
    primitive?: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
  }

  interface GPUVertexState {
    module: GPUShaderModule;
    entryPoint: string;
    buffers?: GPUVertexBufferLayout[];
  }

  interface GPUFragmentState {
    module: GPUShaderModule;
    entryPoint: string;
    targets: GPUColorTargetState[];
  }

  interface GPUColorTargetState {
    format: GPUTextureFormat;
    blend?: GPUBlendState;
    writeMask?: number;
  }

  interface GPUPrimitiveState {
    topology?: 'point-list' | 'line-list' | 'line-strip' | 'triangle-list' | 'triangle-strip';
  }

  interface GPUDepthStencilState {}
  interface GPUMultisampleState {}

  interface GPUVertexBufferLayout {
    arrayStride: number;
    stepMode?: GPUVertexStepMode;
    attributes: GPUVertexAttribute[];
  }

  type GPUVertexStepMode = 'vertex' | 'instance';

  interface GPUVertexAttribute {
    format: GPUVertexFormat;
    offset: number;
    shaderLocation: number;
  }

  type GPUVertexFormat = string;

  interface GPURenderPipeline {}

  interface GPUTextureDescriptor {
    size: GPUExtent3D;
    format: GPUTextureFormat;
    usage: number;
    mipLevelCount?: number;
    sampleCount?: number;
    dimension?: GPUTextureDimension;
  }

  type GPUTextureDimension = '1d' | '2d' | '3d';
  type GPUTextureFormat = string;
  type GPUTextureViewDimension = '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';

  interface GPUTexture {
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
    readonly width: number;
    readonly height: number;
    readonly format: GPUTextureFormat;
    readonly usage: number;
    destroy(): void;
  }

  interface GPUTextureViewDescriptor {}
  interface GPUTextureView {}

  const GPUTextureUsage: {
    readonly COPY_SRC: number;
    readonly COPY_DST: number;
    readonly TEXTURE_BINDING: number;
    readonly STORAGE_BINDING: number;
    readonly RENDER_ATTACHMENT: number;
  };

  interface GPUCommandEncoderDescriptor {
    label?: string;
  }

  interface GPUCommandEncoder {
    beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
    finish(): GPUCommandBuffer;
  }

  interface GPURenderPassDescriptor {
    colorAttachments: (GPURenderPassColorAttachment | null)[];
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
  }

  interface GPURenderPassColorAttachment {
    view: GPUTextureView;
    resolveTarget?: GPUTextureView;
    clearValue?: GPUColor;
    loadOp: GPULoadOp;
    storeOp: GPUStoreOp;
  }

  interface GPURenderPassDepthStencilAttachment {}

  type GPULoadOp = 'load' | 'clear';
  type GPUStoreOp = 'store' | 'discard';

  interface GPUColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  interface GPURenderPassEncoder {
    setPipeline(pipeline: GPURenderPipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
    setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: number, size?: number): void;
    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
    end(): void;
  }

  interface GPUBindGroupDescriptor {
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBindingResource;
  }

  type GPUBindingResource =
    | GPUSampler
    | GPUTextureView
    | GPUBufferBinding
    | GPUExternalTexture;

  interface GPUBufferBinding {
    buffer: GPUBuffer;
    offset?: number;
    size?: number;
  }

  interface GPUExternalTexture {}

  interface GPUBindGroup {}

  interface GPUCommandBuffer {}

  interface GPUBufferDescriptor {
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }

  interface GPUBuffer {}

  const GPUBufferUsage: {
    readonly MAP_READ: number;
    readonly MAP_WRITE: number;
    readonly COPY_SRC: number;
    readonly COPY_DST: number;
    readonly INDEX: number;
    readonly VERTEX: number;
    readonly UNIFORM: number;
    readonly STORAGE: number;
    readonly INDIRECT: number;
    readonly QUERY_RESOLVE: number;
  };

  interface GPUImageCopyExternalImage {
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;
  }

  interface GPUImageCopyTextureTagged {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: GPUOrigin3D;
    aspect?: GPUTextureAspect;
  }

  interface GPUTextureCopyDestination {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: GPUOrigin3D;
    aspect?: GPUTextureAspect;
  }

  interface GPUImageDataLayout {
    offset?: number;
    bytesPerRow?: number;
    rowsPerImage?: number;
  }

  type GPUExtent3D = number[] | { width: number; height?: number; depthOrArrayLayers?: number };
  type GPUOrigin3D = number[] | { x?: number; y?: number; z?: number };
  type GPUTextureAspect = 'all' | 'stencil-only' | 'depth-only';

  interface GPUCanvasContext {
    configure(configuration: GPUCanvasConfiguration): void;
    unconfigure(): void;
    getCurrentTexture(): GPUTexture;
  }

  interface GPUCanvasConfiguration {
    device: GPUDevice;
    format: GPUTextureFormat;
    alphaMode?: 'opaque' | 'premultiplied';
    usage?: number;
  }

  interface HTMLCanvasElement {
    getContext(contextId: 'webgpu'): GPUCanvasContext | null;
  }
}

export {};
