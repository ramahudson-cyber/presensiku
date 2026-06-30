// src/components/SelfieCapture.jsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useSelfie } from '../hooks/useSelfie'

export default function SelfieCapture({ userId, onSuccess }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [status, setStatus] = useState(null) // 'success' | 'error'
  const { uploadSelfie, uploading, error } = useSelfie()

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  // Buka kamera
  const openCamera = async () => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung di browser ini')
      }

      // Request camera with fallback constraints
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 }
        },
        audio: false
      }

      let mediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        // Fallback: try without constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      // Wait for video element to be ready
      const video = videoRef.current
      if (!video) {
        throw new Error('Video element tidak ditemukan')
      }

      video.srcObject = mediaStream
      
      // Important for iOS Safari
      video.setAttribute('playsinline', 'true')
      video.setAttribute('autoplay', 'true')
      video.setAttribute('muted', 'true')
      
      await video.play()

      setStream(mediaStream)
      setCameraOpen(true)
    } catch (err) {
      console.error('Camera error:', err)
      let message = 'Tidak dapat mengakses kamera'
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Kamera tidak ditemukan di perangkat ini.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Kamera sedang digunakan oleh aplikasi lain.'
      } else if (err.name === 'OverconstrainedError') {
        message = 'Resolusi kamera tidak didukung.'
      } else if (err.name === 'NotSupportedError') {
        message = 'Browser tidak mendukung akses kamera. Pastikan menggunakan HTTPS.'
      }
      
      alert(message)
    }
  }

  // Ambil foto
  const capture = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setPreview(dataUrl)
    stream?.getTracks().forEach(t => t.stop())
    setCameraOpen(false)
  }, [stream])

  // Upload foto
  const handleUpload = async () => {
    if (!preview) return
    const blob = await fetch(preview).then(r => r.blob())
    const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' })
    const path = await uploadSelfie(file, userId)
    if (path) {
      setStatus('success')
      onSuccess?.(path)
    } else {
      setStatus('error')
    }
  }

  const reset = () => {
    setPreview(null)
    setStatus(null)
    stream?.getTracks().forEach(t => t.stop())
    setCameraOpen(false)
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
        📸 Selfie Absensi
      </h3>

      {/* Video stream */}
      {cameraOpen && (
        <div className="relative rounded-xl overflow-hidden border-4 border-blue-500">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            controls={false}
            className="w-72 h-56 object-cover bg-black"
          />
          <button
            onClick={capture}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 border-gradient bg-transparent text-white rounded-full px-6 py-2 font-bold shadow-lg hover:scale-105 transition"
          >
            Ambil Foto
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && !cameraOpen && (
        <div className="relative">
          <img src={preview} alt="Preview" className="w-72 h-56 object-cover rounded-xl border-4 border-green-400" />
          <button onClick={reset} className="absolute top-2 right-2 border-gradient bg-transparent p-1">
            <X size={14} />
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Status */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-green-600 font-medium">
          <CheckCircle size={20} /> Selfie berhasil disimpan!
        </div>
      )}
      {(status === 'error' || error) && (
        <div className="flex items-center gap-2 text-red-500 font-medium">
          <AlertCircle size={20} /> {error || 'Gagal upload'}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!preview && !cameraOpen && (
          <button
            onClick={openCamera}
            className="flex items-center gap-2 border-gradient bg-transparent text-white px-5 py-2.5 rounded-xl font-medium transition"
          >
            <Camera size={18} /> Buka Kamera
          </button>
        )}
        {preview && status !== 'success' && (
          <>
            <button onClick={openCamera} className="border-gradient bg-transparent text-white px-4 py-2 rounded-xl text-sm transition">
              Ulangi
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 border-gradient bg-transparent text-white px-5 py-2.5 rounded-xl font-medium transition disabled:opacity-60"
            >
              <Upload size={18} /> {uploading ? 'Mengupload...' : 'Simpan Selfie'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
