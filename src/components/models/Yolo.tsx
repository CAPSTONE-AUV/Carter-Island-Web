import * as ort from 'onnxruntime-web'

export interface Detection {
  bbox: number[]  // [x, y, width, height]
  score: number
  class: string
  className: string
}

class YoloModel {
  private session: ort.InferenceSession | null = null
  private inputShape: number[] = [1, 3, 640, 640] // sesuaikan dengan model Anda
  
  // Mapping class ID ke nama ikan - sesuaikan dengan model Anda
  private classNames = ['ikan']

  // Di Yolo.tsx, tambahkan progress callback
  async loadModel(modelPath: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      if (onProgress) onProgress(0)
      
      // Create session dengan optimized config
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'], // Start with WASM, fallback
        graphOptimizationLevel: 'all',
        enableMemPattern: false, // Disable untuk reduce initial lag
        enableCpuMemArena: false,
         executionMode: 'sequential'
      })
      
      if (onProgress) onProgress(80)
      
      console.log('Model loaded, warming up...')
      
      // Warm-up run
      const warmupData = new Float32Array(3 * 640 * 640)
      const warmupTensor = new ort.Tensor('float32', warmupData, this.inputShape)
      await this.session.run({ [this.session.inputNames[0]]: warmupTensor })
      
      if (onProgress) onProgress(100)
      
      console.log('Model ready for detection')
      
    } catch (error) {
      console.error('Error loading model:', error)
      throw error
    }
  }

  // Pre-processing: Convert image ke tensor format
  preprocess(imageData: ImageData): ort.Tensor {
    const { data, width, height } = imageData
    
    // Resize ke input size model (640x640)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = this.inputShape[2]
    canvas.height = this.inputShape[3]
    
    // Draw dan resize image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')!
    tempCanvas.width = width
    tempCanvas.height = height
    
    const imgData = new ImageData(data, width, height)
    tempCtx.putImageData(imgData, 0, 0)
    
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
    const resizedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Convert ke RGB tensor format [1, 3, 640, 640]
    const tensorData = new Float32Array(3 * canvas.width * canvas.height)
    const pixels = resizedImageData.data
    
    for (let i = 0; i < pixels.length; i += 4) {
      const pixelIndex = i / 4
      tensorData[pixelIndex] = pixels[i] / 255.0 // R
      tensorData[pixelIndex + canvas.width * canvas.height] = pixels[i + 1] / 255.0 // G  
      tensorData[pixelIndex + 2 * canvas.width * canvas.height] = pixels[i + 2] / 255.0 // B
    }
    
    return new ort.Tensor('float32', tensorData, this.inputShape)
  }

  // Post-processing: Convert output ke detections
  postprocess(output: ort.Tensor, originalWidth: number, originalHeight: number): Detection[] {
    const detections: Detection[] = []
    const data = output.data as Float32Array
    
    // YOLOv8 format: [1, 4+num_classes, 8400]
    // Dari log Anda: [1, 5, 8400] = 4 bbox + 1 class
    const [batch, channels, numBoxes] = output.dims
    console.log('Processing output:', { batch, channels, numBoxes })
    
    for (let i = 0; i < numBoxes; i++) {
      // YOLOv8 format: data disusun per channel
      const x_center = data[i]                    // index 0*8400 + i
      const y_center = data[numBoxes + i]         // index 1*8400 + i  
      const width = data[2 * numBoxes + i]       // index 2*8400 + i
      const height = data[3 * numBoxes + i]      // index 3*8400 + i
      const confidence = data[4 * numBoxes + i]  // index 4*8400 + i (class score)
      
      // Filter berdasarkan confidence threshold
      if (confidence > 0.75) { // Turunkan threshold untuk testing
        // Convert dari center format ke corner format
        // dan scale ke ukuran original image
        const area = width * height
        const imageArea = originalWidth * originalHeight
        const areaRatio = area / imageArea

        const aspectRatio = width / height
        if (aspectRatio < 0.2 || aspectRatio > 5.0) { // Ikan biasanya memanjang
          continue
        }

        const centerY = y_center / originalHeight
        if (centerY < 0.2) {
          continue // Skip detections in top 20% of image
        }

        const scaleX = originalWidth / this.inputShape[2]  // original_width / 640
        const scaleY = originalHeight / this.inputShape[3] // original_height / 640
        
        const x1 = (x_center - width / 2) * scaleX
        const y1 = (y_center - height / 2) * scaleY
        const w = width * scaleX
        const h = height * scaleY
        
        detections.push({
          bbox: [x1, y1, w, h],
          score: confidence,
          class: "0", // semua ikan dianggap class 0
          className: this.classNames[0] || 'ikan'
        })
      }
    }
    
    console.log(`Raw detections: ${detections.length}`)
    
    // Apply Non-Maximum Suppression untuk mengurangi duplikasi
    const filteredDetections = this.applyNMS(detections, 0.3)
    console.log(`After NMS: ${filteredDetections.length}`)
    
    return filteredDetections
  }

  // Non-maximum suppression untuk menghilangkan deteksi duplikat
  private applyNMS(detections: Detection[], iouThreshold: number): Detection[] {
    if (detections.length === 0) return []
    
    // Sort berdasarkan confidence score (tertinggi dulu)
    detections.sort((a, b) => b.score - a.score)
    
    const keep: boolean[] = new Array(detections.length).fill(true)
    
    for (let i = 0; i < detections.length; i++) {
      if (!keep[i]) continue
      
      for (let j = i + 1; j < detections.length; j++) {
        if (!keep[j]) continue
        
        const iou = this.calculateIoU(detections[i].bbox, detections[j].bbox)
        if (iou > iouThreshold) {
          keep[j] = false // Hapus detection dengan confidence lebih rendah
        }
      }
    }
    
    const result = detections.filter((_, i) => keep[i])
    console.log(`NMS kept ${result.length} out of ${detections.length} detections`)
    return result
  }

  private calculateIoU(box1: number[], box2: number[]): number {
    const [x1, y1, w1, h1] = box1
    const [x2, y2, w2, h2] = box2
    
    // Convert ke corner coordinates
    const x1_min = x1, y1_min = y1, x1_max = x1 + w1, y1_max = y1 + h1
    const x2_min = x2, y2_min = y2, x2_max = x2 + w2, y2_max = y2 + h2
    
    // Calculate intersection
    const intersect_x_min = Math.max(x1_min, x2_min)
    const intersect_y_min = Math.max(y1_min, y2_min)
    const intersect_x_max = Math.min(x1_max, x2_max)
    const intersect_y_max = Math.min(y1_max, y2_max)
    
    if (intersect_x_max <= intersect_x_min || intersect_y_max <= intersect_y_min) {
      return 0.0 // No intersection
    }
    
    const intersect_area = (intersect_x_max - intersect_x_min) * (intersect_y_max - intersect_y_min)
    const box1_area = w1 * h1
    const box2_area = w2 * h2
    const union_area = box1_area + box2_area - intersect_area
    
    return intersect_area / union_area
  }

  async predict(imageData: ImageData): Promise<Detection[]> {
    if (!this.session) {
      throw new Error('Model not loaded')
    }

    try {
      const inputTensor = this.preprocess(imageData)
      const feeds = { [this.session.inputNames[0]]: inputTensor }
      
      const results = await this.session.run(feeds)
      const output = results[this.session.outputNames[0]]
      
      console.log('Inference completed, output shape:', output.dims) // Debug log
      
      return this.postprocess(output, imageData.width, imageData.height)
    } catch (error) {
      console.error('Prediction error:', error)
      return [] // Return empty array instead of throwing
    }
  }
}

export default YoloModel