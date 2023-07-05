import shaderCode from './triangle.wgsl'

(async() => {
    if(navigator.gpu === undefined){
        console.log("WebGPU is not supported. Enable chrome://flags/#enable-unsafe-webgpu flag.")
        return;
    }

    /*********************************
     * GET A GPU DEVICE TO RENDER WITH
     * ******************************/
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    /*********************************
     * GET THE CANVAS CONTEXT
     * ******************************/
    const canvas = document.getElementById("webgpu-canvas");
    const context = canvas.getContext("webgpu");

    /*********************************
     * CREATE SHADER MODULE
     * ******************************/
    const shaderModule = device.createShaderModule({code: shaderCode});
    // checking the compilation info of the shader and consoling the error if exists
    const compilationInfo = await shaderModule.getCompilationInfo();
    if(compilationInfo.messages.length > 0){
        let hadError = false;
        console.log("Shader compilation lof: ");
        for(let i = 0; i < compilationInfo.messages.length; i++){
            let msg = compilationInfo.messages[i];
            console.log(`${msg.lineNum}:${msg.linePos} - ${msg.message}`);
            hadError = hadError || msg.type == "errpr";
        }

        if(hadError){
            console.log("Shader Failed to Compile");
            return;
        }
    }

    /*********************************
     * UPLOAD VERTEX DATA
     * ******************************/
    // specify the vertex data
    //  allocate room for the vertex data: 3vertices each with 2 float4's
    const dataBuf = device.createBuffer({
        size: 3 * 2 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true 
    });

    //  InterLeaved positions and colors
    new Float32Array(dataBuf.getMappedRange()).set([
        1, -1, 0, 1,  // position
    1, 0, 0, 1,   // color
    -1, -1, 0, 1, // position
    0, 1, 0, 1,   // color
    0, 1, 0, 1,   // position
    0, 0, 1, 1,   // color
    ]);

    dataBuf.unmap()

    // vertex attribute state and shader stage
    const vertexState = {
        // shader stage info
        module: shaderModule,
        entryPoint: 'vertex_main',
        // vertex buffer info
        buffers:[{
            arrayStride: 2 * 4 * 4,
            attributes: [
                {format: 'float32x4', offset: 0, shaderLocation: 0},
                {format:'float32x4', offset: 4 * 4, shaderLocation: 1}
            ] 
        }]
    }

    /*********************************
     * SETUP RENDER OUTPUTS
     * ******************************/
    const swapChainFormat = "bgra8unorm";
    context.configure({
        device: device,
        format: swapChainFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const depthFormat = "depth24plus-stencil8";
    const depthTexture = device.createTexture({
        size: {
            width: canvas.width,
            height: canvas.height,
            depth: 1
        },
        format: depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const fragmentState = {
        // shader info
        module: shaderModule,
        entryPoint: "fragment_main",
        // output render target info
        targets: [{format: swapChainFormat}]
    };


    /*********************************
     * CREATE RENDER PIPELINE
     * ******************************/
    const layout = device.createPipelineLayout({bindGroupLayouts: []});

    const renderPipeline = device.createRenderPipeline({
        layout: layout,
        vertex: vertexState,
        fragment: fragmentState,
        depthStencil: {
            format: depthFormat,
            depthWriteEnabled: true,
            depthCompare: "less"
        }
    });


    /*********************************
     * RENDER
     * ******************************/
    const renderPassDesc = {
        colorAttachments: [{
            // view will be set to the current render target each frame
            view: undefined,
            loadOp: "clear",
            loadValue: [0.3, 0.3, 0.3, 1],
            storeOp: "store"
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadOp: "clear",
            depthClearValue: 1.0,
            depthStoreOp: "store",
            stencilLoadOp: "clear",
            stencilClearValue: 0,
            stencilStoreOp: "store"
        }
    };

    const frame = function(){
        renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();

        const commandEncoder = device.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass(renderPassDesc);

        renderPass.setPipeline(renderPipeline);
        renderPass.setVertexBuffer(0, dataBuf);
        renderPass.draw(3, 1, 0, 0);

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);



})();