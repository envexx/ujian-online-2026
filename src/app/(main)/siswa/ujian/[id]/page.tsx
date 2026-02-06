"use client";

import { useState, useEffect, useRef } from "react";
import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MathRenderer } from "@/components/ui/math-renderer";
import { ArrowLeft, Clock, CheckCircle, LockKey, Warning, FloppyDisk, CircleNotch, Camera, ImageSquare, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { examQueue, generateChecksum } from "@/lib/exam-queue";

export default function SiswaUjianDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState("");
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0); // Waktu tersisa dalam detik (dari server)
  const [currentQuestion, setCurrentQuestion] = useState(0);
  
  const [ujianData, setUjianData] = useState<any>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [essayImages, setEssayImages] = useState<{ [key: string]: string }>({}); // Store base64 images for essay
  const [essayInputMode, setEssayInputMode] = useState<{ [key: string]: 'text' | 'image' }>({}); // Input mode per question
  const [showCameraModal, setShowCameraModal] = useState(false); // Modal webcam
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null); // Preview foto yang diambil
  const [cameraQuestionId, setCameraQuestionId] = useState<string | null>(null); // ID soal untuk foto
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false); // Status upload
  const [cameraLoading, setCameraLoading] = useState(true); // Loading state untuk webcam
  const [cameraError, setCameraError] = useState<string | null>(null); // Error state untuk webcam
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null); // WebRTC stream
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Queue-based auto-save states
  const [queueStatus, setQueueStatus] = useState({ total: 0, saved: 0, pending: 0, saving: 0, failed: 0 });
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: 'saved' | 'saving' | 'typing' | 'error' }>({});
  const [lastSaved, setLastSaved] = useState<{ [key: string]: Date }>({});
  const saveTimersRef = React.useRef<{ [key: string]: NodeJS.Timeout }>({});
  const hasAutoSubmittedRef = React.useRef(false);
  const isInitialLoadRef = React.useRef(true);

  // Get localStorage key for this exam
  const getStorageKey = () => `ujian_${params.id}_answers`;
  const getImagesStorageKey = () => `ujian_${params.id}_images`;
  const getInputModeStorageKey = () => `ujian_${params.id}_inputMode`;

  // Load answers from localStorage
  const loadAnswersFromStorage = () => {
    if (!params.id) return;
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        setAnswers(parsed);
        // Set all as saved initially
        const status: { [key: string]: 'saved' } = {};
        Object.keys(parsed).forEach((key) => {
          status[key] = 'saved';
        });
        setSaveStatus(status);
      }

      // Load images
      const storedImages = localStorage.getItem(getImagesStorageKey());
      if (storedImages) {
        const parsedImages = JSON.parse(storedImages);
        setEssayImages(parsedImages);
      }

      // Load input modes
      const storedModes = localStorage.getItem(getInputModeStorageKey());
      if (storedModes) {
        const parsedModes = JSON.parse(storedModes) as { [key: string]: 'text' | 'image' };
        setEssayInputMode(parsedModes);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  };

  // Save to localStorage
  const saveToLocalStorage = (questionId: string, answer: string) => {
    if (!params.id) return;
    try {
      const current = { ...answers, [questionId]: answer };
      localStorage.setItem(getStorageKey(), JSON.stringify(current));
      
      // Also save images and modes
      localStorage.setItem(getImagesStorageKey(), JSON.stringify(essayImages));
      localStorage.setItem(getInputModeStorageKey(), JSON.stringify(essayInputMode));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  // Fetch waktu tersisa dari server (hanya sekali saat mulai atau reload)
  const fetchTimeRemaining = React.useCallback(async () => {
    if (!params.id) return;
    
    try {
      const response = await fetch(`/api/siswa/ujian/${params.id}/time-remaining`);
      const result = await response.json();
      
      if (result.success) {
        const { timeRemaining, isExpired } = result.data;
        setTimeRemaining(timeRemaining);
        
        // Jika waktu habis, trigger auto-submit check
        if (isExpired) {
          setTimeRemaining(0);
        }
      }
    } catch (error) {
      console.error('Error fetching time remaining:', error);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      // Initialize exam queue
      examQueue.setExamId(params.id as string);
      
      // Reset semua state saat reload
      setIsStarted(false);
      setTimeRemaining(0);
      hasAutoSubmittedRef.current = false;
      isInitialLoadRef.current = true;
      
      fetchUjianDetail();
      loadAnswersFromStorage();
      
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 2000);
    }
  }, [params.id]);

  // Monitor queue status
  useEffect(() => {
    if (!isStarted) return;

    const interval = setInterval(() => {
      const status = examQueue.getQueueStatus();
      setQueueStatus(status);
    }, 500);

    return () => clearInterval(interval);
  }, [isStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Ensure currentQuestion is within valid range
  useEffect(() => {
    if (!ujianData) return;
    const { soalPG, soalEssay } = ujianData;
    const allQuestions = [...(soalPG || []), ...(soalEssay || [])];
    if (allQuestions.length > 0 && currentQuestion >= allQuestions.length) {
      setCurrentQuestion(Math.max(0, allQuestions.length - 1));
    }
  }, [ujianData, currentQuestion]);

  // Handle auto-submit (dipanggil saat waktu habis)
  const handleAutoSubmit = React.useCallback(async () => {
    // GUARD: Jangan submit jika masih initial load
    if (isInitialLoadRef.current) {
      console.log('Auto-submit blocked: masih initial load');
      return;
    }

    // GUARD: Jangan submit jika sudah pernah submit
    if (isSubmitting || hasAutoSubmittedRef.current) {
      return;
    }

    // GUARD: Cek apakah submission sudah di-submit
    if (ujianData?.submission?.submittedAt) {
      console.log('Auto-submit blocked: submission sudah di-submit');
      return;
    }
    
    setIsSubmitting(true);
    hasAutoSubmittedRef.current = true;
    
    try {
      const storageKey = getStorageKey();
      
      const response = await fetch(`/api/siswa/ujian/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear localStorage (answers and shuffle order)
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`ujian_${params.id}_shuffled_order`);
        
        // Clear all timers
        Object.values(saveTimersRef.current).forEach((timer) => {
          if (timer) clearTimeout(timer);
        });
        
        toast.success("Waktu ujian habis. Ujian berhasil dikumpulkan!");
        // Redirect ke halaman hasil setelah submit berhasil
        setTimeout(() => {
          router.push(`/siswa/ujian/${params.id}/hasil`);
        }, 500);
      } else {
        // Jika error karena sudah di-submit, redirect ke hasil
        if (result.error?.includes('sudah') || result.error?.includes('submitted') || result.error?.includes('dikumpulkan')) {
          toast.info("Ujian sudah dikumpulkan sebelumnya");
          setTimeout(() => {
            router.push(`/siswa/ujian/${params.id}/hasil`);
          }, 500);
          return;
        }
        toast.error(result.error || "Gagal mengumpulkan ujian");
        setIsSubmitting(false);
        hasAutoSubmittedRef.current = false;
      }
    } catch (error) {
      console.error('Error submitting ujian:', error);
      toast.error("Terjadi kesalahan");
      setIsSubmitting(false);
      hasAutoSubmittedRef.current = false;
    }
  }, [params.id, answers, isSubmitting, ujianData]);

  // Countdown timer di frontend (setiap detik)
  // Timer hanya dibuat sekali saat isStarted = true, tidak re-create setiap detik
  useEffect(() => {
    if (!isStarted) return;

    // Jangan start timer jika waktu sudah habis (mungkin dari reload)
    // Biarkan auto-submit check yang handle ini
    if (timeRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0; // Jangan minus
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, timeRemaining]); // Depend pada timeRemaining untuk handle reload dengan waktu habis

  // Auto-submit check: jika waktu habis DAN minimal ada 1 soal terjawab
  useEffect(() => {
    // GUARD: Jangan auto-submit saat initial load/reload
    if (isInitialLoadRef.current) {
      console.log('Auto-submit blocked: masih initial load');
      return;
    }

    // GUARD: Jangan auto-submit jika ujian belum dimulai
    if (!isStarted) {
      return;
    }

    // GUARD: Jangan auto-submit jika waktu masih ada
    if (timeRemaining > 0) {
      return;
    }

    // GUARD: Jangan auto-submit jika sudah pernah submit
    if (hasAutoSubmittedRef.current || isSubmitting) {
      return;
    }

    // GUARD: Cek apakah submission sudah di-submit (dari ujianData)
    if (ujianData?.submission?.submittedAt) {
      console.log('Auto-submit blocked: submission sudah di-submit');
      return;
    }

    const answeredCount = Object.keys(answers).filter(key => {
      const answer = answers[key];
      return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
    }).length;

    if (answeredCount > 0) {
      console.log('Time expired, auto-submitting with', answeredCount, 'answered questions');
      // Direct submit tanpa modal konfirmasi untuk auto-submit
      handleAutoSubmit();
    }
  }, [timeRemaining, isStarted, answers, isSubmitting, handleAutoSubmit, ujianData]);

  // Helper function to shuffle array (Fisher-Yates algorithm)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchUjianDetail = async () => {
    try {
      const response = await fetch(`/api/siswa/ujian/${params.id}`);
      const result = await response.json();
      
      if (result.success) {
        let processedData = { ...result.data };
        
        // Debug: Log data yang diterima
        console.log('Data ujian diterima:', {
          hasUjian: !!processedData.ujian,
          soalPGCount: processedData.soalPG?.length || 0,
          soalEssayCount: processedData.soalEssay?.length || 0,
          soalPG: processedData.soalPG,
          soalEssay: processedData.soalEssay,
        });
        
        // Guard: Pastikan soalPG dan soalEssay adalah array
        if (!Array.isArray(processedData.soalPG)) {
          console.warn('soalPG is not an array:', processedData.soalPG);
          processedData.soalPG = [];
        }
        if (!Array.isArray(processedData.soalEssay)) {
          console.warn('soalEssay is not an array:', processedData.soalEssay);
          processedData.soalEssay = [];
        }
        
        // Check if shuffleQuestions is enabled
        if (result.data.ujian?.shuffleQuestions) {
          // Check if shuffled order already exists in localStorage (to maintain consistency on reload)
          const shuffleKey = `ujian_${params.id}_shuffled_order`;
          const storedShuffle = localStorage.getItem(shuffleKey);
          
          if (storedShuffle) {
            // Use stored shuffle order
            try {
              const { soalPGOrder, soalEssayOrder } = JSON.parse(storedShuffle);
              
              // Reorder soal PG based on stored order
              if (processedData.soalPG && processedData.soalPG.length > 0 && soalPGOrder && Array.isArray(soalPGOrder)) {
                const soalPGMap = new Map(processedData.soalPG.map((s: any) => [s.id, s]));
                const reorderedPG = soalPGOrder
                  .map((id: string) => soalPGMap.get(id))
                  .filter((s: any) => s !== undefined);
                
                // Only use reordered if we got all questions, otherwise use original
                if (reorderedPG.length === processedData.soalPG.length) {
                  processedData.soalPG = reorderedPG.map((soal: any, idx: number) => ({
                    ...soal,
                    nomor: idx + 1,
                  }));
                } else {
                  console.warn('Stored PG order tidak match, menggunakan urutan asli');
                }
              }
              
              // Reorder soal Essay based on stored order
              if (processedData.soalEssay && processedData.soalEssay.length > 0 && soalEssayOrder && Array.isArray(soalEssayOrder)) {
                const soalEssayMap = new Map(processedData.soalEssay.map((s: any) => [s.id, s]));
                const reorderedEssay = soalEssayOrder
                  .map((id: string) => soalEssayMap.get(id))
                  .filter((s: any) => s !== undefined);
                
                // Only use reordered if we got all questions, otherwise use original
                if (reorderedEssay.length === processedData.soalEssay.length) {
                  processedData.soalEssay = reorderedEssay.map((soal: any, idx: number) => ({
                    ...soal,
                    nomor: idx + 1,
                  }));
                } else {
                  console.warn('Stored Essay order tidak match, menggunakan urutan asli');
                }
              }
              
              console.log('Menggunakan urutan soal yang sudah di-shuffle sebelumnya');
            } catch (error) {
              console.error('Error parsing stored shuffle order:', error);
              // Fall through to shuffle again
            }
          }
          
          // If no stored order, shuffle and save it
          if (!storedShuffle) {
            // Shuffle soal PG if exists
            if (processedData.soalPG && processedData.soalPG.length > 0) {
              processedData.soalPG = shuffleArray(processedData.soalPG);
              // Update nomor setelah shuffle
              processedData.soalPG = processedData.soalPG.map((soal: any, idx: number) => ({
                ...soal,
                nomor: idx + 1,
              }));
            }
            
            // Shuffle soal Essay if exists
            if (processedData.soalEssay && processedData.soalEssay.length > 0) {
              processedData.soalEssay = shuffleArray(processedData.soalEssay);
              // Update nomor setelah shuffle
              processedData.soalEssay = processedData.soalEssay.map((soal: any, idx: number) => ({
                ...soal,
                nomor: idx + 1,
              }));
            }
            
            // Save shuffled order to localStorage
            const shuffleOrder = {
              soalPGOrder: processedData.soalPG?.map((s: any) => s.id) || [],
              soalEssayOrder: processedData.soalEssay?.map((s: any) => s.id) || [],
            };
            localStorage.setItem(shuffleKey, JSON.stringify(shuffleOrder));
            
            console.log('Soal diacak karena shuffleQuestions aktif');
          }
        }
        
        // Final check: Pastikan data valid sebelum di-set
        console.log('Data sebelum di-set ke state:', {
          hasUjian: !!processedData.ujian,
          soalPGCount: processedData.soalPG?.length || 0,
          soalEssayCount: processedData.soalEssay?.length || 0,
          soalPGIsArray: Array.isArray(processedData.soalPG),
          soalEssayIsArray: Array.isArray(processedData.soalEssay),
          rawSoalPG: processedData.soalPG,
          rawSoalEssay: processedData.soalEssay,
        });
        
        // Ensure arrays are always arrays and not null/undefined
        if (!Array.isArray(processedData.soalPG)) {
          console.warn('soalPG is not array, converting:', processedData.soalPG);
          processedData.soalPG = [];
        }
        if (!Array.isArray(processedData.soalEssay)) {
          console.warn('soalEssay is not array, converting:', processedData.soalEssay);
          processedData.soalEssay = [];
        }
        
        // Final validation: Pastikan minimal ada 1 soal
        const totalSoal = processedData.soalPG.length + processedData.soalEssay.length;
        if (totalSoal === 0) {
          console.error('ERROR: Tidak ada soal setelah processing!', {
            originalSoalPG: result.data.soalPG,
            originalSoalEssay: result.data.soalEssay,
            processedSoalPG: processedData.soalPG,
            processedSoalEssay: processedData.soalEssay,
          });
          toast.error('Tidak ada soal dalam ujian ini. Silakan hubungi administrator.');
          return;
        }
        
        console.log('Data valid, setting to state. Total soal:', totalSoal);
        setUjianData(processedData);
        
        // Check if already submitted
        if (result.data.submission && result.data.submission.submittedAt) {
          toast.info("Anda sudah mengerjakan ujian ini");
          // Redirect ke halaman hasil jika sudah di-submit
          setTimeout(() => {
            router.push(`/siswa/ujian/${params.id}/hasil`);
          }, 500);
          return;
        }
        
        // Check if can start
        if (!result.data.canStart) {
          const accessMessage = result.data.accessMessage || "Ujian belum dapat dimulai";
          toast.error(accessMessage);
          router.push('/siswa/ujian');
          return;
        }
        
        // Set waktu tersisa dari response (saat load pertama kali atau reload)
        if (result.data.timeRemaining !== undefined) {
          setTimeRemaining(result.data.timeRemaining);
          
          // Jika ada submission (sudah mulai), set isStarted
          if (result.data.submission && result.data.submission.startedAt && !result.data.submission.submittedAt) {
            setIsStarted(true);
            // Reset flag untuk memungkinkan auto-submit jika waktu benar-benar habis
            // Tapi tetap beri delay untuk mencegah auto-submit saat reload
            setTimeout(() => {
              isInitialLoadRef.current = false;
            }, 3000); // 3 detik delay setelah reload
          }
        }
      } else {
        toast.error(result.error || "Gagal memuat data ujian");
        router.push('/siswa/ujian');
      }
    } catch (error) {
      console.error('Error fetching ujian:', error);
      toast.error("Terjadi kesalahan");
      router.push('/siswa/ujian');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExam = () => {
    setShowTokenModal(true);
  };

  const handleValidateToken = async () => {
    if (!token.trim()) {
      toast.error("Token harus diisi");
      return;
    }

    setIsValidatingToken(true);
    try {
      const response = await fetch('/api/siswa/ujian/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Token valid! Ujian dimulai");
        setShowTokenModal(false);
        setIsStarted(true);
        hasAutoSubmittedRef.current = false;
        isInitialLoadRef.current = false; // Setelah token valid, bukan initial load lagi
        // Fetch waktu tersisa sekali setelah token valid
        fetchTimeRemaining();
      } else {
        toast.error(result.error || "Token tidak valid");
      }
    } catch (error) {
      console.error('Error validating token:', error);
      toast.error("Terjadi kesalahan saat validasi token");
    } finally {
      setIsValidatingToken(false);
    }
  };

  // Queue-based save (replaces old auto-save)
  const saveAnswerToQueue = (questionId: string, questionType: 'multiple_choice' | 'essay', answer: string) => {
    // Add to queue
    examQueue.addAnswer(questionId, questionType, answer);
    
    // Update UI status
    setSaveStatus((prev) => ({ ...prev, [questionId]: 'saving' }));
    
    // Check status after a delay
    setTimeout(() => {
      const status = examQueue.getQueueStatus();
      const failedAnswers = examQueue.getFailedAnswers();
      const isFailed = failedAnswers.some(a => a.questionId === questionId);
      
      if (isFailed) {
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'error' }));
      } else {
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
        setLastSaved((prev) => ({ ...prev, [questionId]: new Date() }));
      }
    }, 1000);
  };

  // Check camera availability
  // Fungsi untuk start kamera dengan WebRTC
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Gunakan kamera belakang
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setCameraLoading(false);
      setCameraError(null);
    } catch (error: any) {
      console.error('Camera access error:', error);
      setCameraLoading(false);
      
      const errorName = error.name || String(error);
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setCameraError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setCameraError('Kamera tidak ditemukan pada perangkat Anda.');
      } else {
        setCameraError('Tidak dapat mengakses kamera. Pastikan kamera tidak digunakan aplikasi lain.');
      }
    }
  };

  // Fungsi untuk stop kamera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Fungsi untuk membuka modal kamera
  const openCameraModal = (questionId: string) => {
    setCameraQuestionId(questionId);
    setCapturedPhoto(null); // Reset captured photo
    setShowCameraModal(true);
    // Start camera setelah modal terbuka
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  // Fungsi untuk capture foto dari video stream
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Kamera tidak siap. Coba lagi.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size sesuai video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame ke canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas ke base64
      const imageSrc = canvas.toDataURL('image/jpeg', 0.9);
      
      if (imageSrc) {
        setCapturedPhoto(imageSrc);
        stopCamera(); // Stop kamera setelah capture
        toast.success('Foto berhasil diambil! Periksa dan konfirmasi foto Anda.');
      } else {
        toast.error('Gagal mengambil foto. Coba lagi.');
      }
    }
  };



  // Fungsi untuk konfirmasi dan upload foto
  const handleConfirmPhoto = async () => {
    if (!capturedPhoto || !cameraQuestionId) return;
    
    setIsUploadingPhoto(true);
    await processImage(capturedPhoto, cameraQuestionId);
    setIsUploadingPhoto(false);
    setCapturedPhoto(null); // Reset preview setelah upload berhasil
    setShowCameraModal(false); // Tutup modal
    stopCamera(); // Pastikan kamera berhenti
  };

  // Fungsi untuk ambil ulang foto
  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    toast.info('Silakan ambil foto ulang');
    // Restart kamera
    startCamera();
  };

  // Cleanup kamera saat modal ditutup
  const handleCloseModal = () => {
    stopCamera();
    setShowCameraModal(false);
    setCapturedPhoto(null);
    setCameraQuestionId(null);
    setCameraLoading(true);
    setCameraError(null);
  };

  const processImage = async (imageSrc: string, questionId: string) => {
    try {
      // Show loading
      toast.loading('Mengupload foto ke server...', { id: 'upload-image' });

      // Upload to R2
      const response = await fetch('/api/upload/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageSrc,
          fileName: `essay-${questionId}`,
          folder: 'essay-answers',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal mengupload foto');
      }

      const imageUrl = result.data.url;

      // Store image URL (not base64)
      const newImages = { ...essayImages, [questionId]: imageUrl };
      setEssayImages(newImages);
      
      // Set input mode to image
      const newModes: { [key: string]: 'text' | 'image' } = { ...essayInputMode, [questionId]: 'image' as const };
      setEssayInputMode(newModes);
      
      // Save image URL as answer (not base64)
      handleAnswerChange(questionId, imageUrl, 'essay');
      
      // Save to localStorage
      try {
        localStorage.setItem(getImagesStorageKey(), JSON.stringify(newImages));
        localStorage.setItem(getInputModeStorageKey(), JSON.stringify(newModes));
      } catch (error) {
        console.error('Error saving images to localStorage:', error);
      }
      
      // Close dialog
      setShowCameraModal(false);
      setCameraQuestionId(null);
      
      toast.success('Foto berhasil diupload dan disimpan', { id: 'upload-image' });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Gagal mengupload foto. Silakan coba lagi.', { id: 'upload-image' });
    }
  };

  const handleAnswerChange = (questionId: string, answer: string, questionType: 'multiple_choice' | 'essay') => {
    // Update state
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    // Save to localStorage immediately
    saveToLocalStorage(questionId, answer);

    if (questionType === 'multiple_choice') {
      // Instant save for PG via queue
      saveAnswerToQueue(questionId, 'multiple_choice', answer);
    } else {
      // Debounced save for Essay
      setSaveStatus((prev) => ({ ...prev, [questionId]: 'typing' }));

      // Clear existing timer
      if (saveTimersRef.current[questionId]) {
        clearTimeout(saveTimersRef.current[questionId]);
      }

      // Set new timer (2 seconds debounce)
      const timer = setTimeout(() => {
        saveAnswerToQueue(questionId, 'essay', answer);
      }, 2000);

      saveTimersRef.current[questionId] = timer;
    }
  };

  const validateAllAnswers = () => {
    if (!ujianData) return { valid: false, message: "" };
    
    const { soalPG, soalEssay } = ujianData;
    const allQuestions = [...(soalPG || []), ...(soalEssay || [])];
    const unansweredQuestions: number[] = [];

    allQuestions.forEach((q: any, idx: number) => {
      const answer = answers[q.id];
      if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
        unansweredQuestions.push(idx + 1);
      }
    });

    if (unansweredQuestions.length > 0) {
      const soalList = unansweredQuestions.length <= 5 
        ? unansweredQuestions.join(", ")
        : `${unansweredQuestions.slice(0, 5).join(", ")} dan ${unansweredQuestions.length - 5} soal lainnya`;
      
      return {
        valid: false,
        message: `Masih ada ${unansweredQuestions.length} soal yang belum dijawab:\nSoal nomor: ${soalList}\n\nPastikan semua soal sudah dijawab sebelum mengumpulkan ujian.`
      };
    }

    return { valid: true, message: "" };
  };

  const handleSubmitClick = () => {
    // GUARD: Jangan submit jika ujian belum dimulai
    if (!isStarted) {
      console.log('Submit blocked: ujian belum dimulai');
      return;
    }

    // GUARD: Jangan submit jika sedang submitting
    if (isSubmitting) {
      console.log('Submit blocked: sedang submitting');
      return;
    }

    // GUARD: Untuk auto-submit (waktu habis), minimal harus ada 1 soal yang sudah dijawab
    const answeredCount = Object.keys(answers).filter(key => {
      const answer = answers[key];
      return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
    }).length;

    // Jika auto-submit (waktu habis), langsung submit tanpa validasi lengkap
    if (timeRemaining <= 0 && answeredCount > 0) {
      console.log('Auto-submit: waktu habis dengan', answeredCount, 'soal terjawab');
      handleConfirmSubmit();
      return;
    }

    // Untuk manual submit, validasi semua harus terisi
    const validation = validateAllAnswers();
    
    if (!validation.valid) {
      setValidationMessage(validation.message);
      setShowValidationError(true);
      return;
    }

    // Jika semua valid, tampilkan modal konfirmasi
    console.log('Opening submit modal...');
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setShowSubmitModal(false);
    
    try {
      // STEP 1: Wait for all auto-saves to complete
      toast.info('Menunggu semua jawaban tersimpan...');
      const allSaved = await examQueue.waitForAllSaved(120000); // 2 minutes timeout

      if (!allSaved) {
        const failedAnswers = examQueue.getFailedAnswers();
        const pendingAnswers = examQueue.getPendingAnswers();
        
        const confirmSubmit = window.confirm(
          `⚠️ Peringatan!\n\n` +
          `${failedAnswers.length} soal gagal tersimpan\n` +
          `${pendingAnswers.length} soal masih dalam proses penyimpanan\n\n` +
          `Lanjutkan submit tanpa soal ini?`
        );

        if (!confirmSubmit) {
          setIsSubmitting(false);
          toast.error('Harap tunggu hingga semua jawaban tersimpan atau perbaiki koneksi internet');
          return;
        }
      }

      // STEP 2: Get all answers from queue
      const queueAnswers = examQueue.getAllAnswers();
      const finalAnswers = { ...queueAnswers, ...answers };

      // STEP 3: Generate checksum
      const checksum = generateChecksum(finalAnswers);

      // STEP 4: Submit with enhanced endpoint
      const storageKey = getStorageKey();
      
      const response = await fetch(`/api/siswa/ujian/${params.id}/submit-enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: finalAnswers,
          checksum,
          totalQuestions: Object.keys(finalAnswers).length,
          submittedAt: new Date().toISOString()
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear queue
        examQueue.clear();
        
        // Clear localStorage
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`ujian_${params.id}_shuffled_order`);
        
        // Clear timers
        Object.values(saveTimersRef.current).forEach((timer) => {
          if (timer) clearTimeout(timer);
        });
        
        toast.success(result.message || "Ujian berhasil dikumpulkan!");
        setTimeout(() => {
          router.push(`/siswa/ujian/${params.id}/hasil`);
        }, 500);
      } else {
        if (result.message?.includes('sudah') || result.message?.includes('submitted') || result.message?.includes('dikumpulkan')) {
          toast.info("Ujian sudah dikumpulkan sebelumnya");
          setTimeout(() => {
            router.push(`/siswa/ujian/${params.id}/hasil`);
          }, 500);
          return;
        }
        toast.error(result.message || "Gagal mengumpulkan ujian");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error submitting ujian:', error);
      toast.error("Terjadi kesalahan");
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!ujianData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Ujian tidak ditemukan</p>
      </div>
    );
  }

  // Guard: Pastikan ujianData memiliki struktur yang benar
  if (!ujianData || !ujianData.ujian) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Data ujian tidak valid</p>
        </div>
      </div>
    );
  }

  const { ujian, soalPG, soalEssay, examEndTime } = ujianData;
  
  // Guard: Pastikan ujian ada
  if (!ujian) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Data ujian tidak valid</p>
        </div>
      </div>
    );
  }

  // Guard: Pastikan soalPG dan soalEssay adalah array
  const safeSoalPG = Array.isArray(soalPG) ? soalPG : [];
  const safeSoalEssay = Array.isArray(soalEssay) ? soalEssay : [];
  const allQuestions = [...safeSoalPG, ...safeSoalEssay];
  
  // Debug: Log untuk troubleshooting
  console.log('Rendering check:', {
    soalPGType: typeof soalPG,
    soalPGIsArray: Array.isArray(soalPG),
    soalPGLength: soalPG?.length,
    safeSoalPGLength: safeSoalPG.length,
    soalEssayType: typeof soalEssay,
    soalEssayIsArray: Array.isArray(soalEssay),
    soalEssayLength: soalEssay?.length,
    safeSoalEssayLength: safeSoalEssay.length,
    allQuestionsLength: allQuestions.length,
    ujianDataKeys: Object.keys(ujianData || {}),
  });
  
  // Guard: Pastikan ada soal
  if (allQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-bold">Tidak ada soal dalam ujian ini</p>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Debug Info:</p>
            <p>soalPG: {soalPG ? `${Array.isArray(soalPG) ? soalPG.length : 'not array'}` : 'null/undefined'}</p>
            <p>soalEssay: {soalEssay ? `${Array.isArray(soalEssay) ? soalEssay.length : 'not array'}` : 'null/undefined'}</p>
            <p>ujianData keys: {ujianData ? Object.keys(ujianData).join(', ') : 'null'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Guard: Pastikan currentQuestion dalam range
  const safeCurrentQuestion = Math.max(0, Math.min(currentQuestion, allQuestions.length - 1));
  const currentQ = allQuestions[safeCurrentQuestion];
  const isPG = safeCurrentQuestion < safeSoalPG.length;

  // Guard: Jika currentQ tidak ada atau tidak memiliki pertanyaan, tampilkan error
  if (!currentQ || !currentQ.pertanyaan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Data soal tidak valid</p>
        </div>
      </div>
    );
  }

  // Get waktu mulai dan akhir ujian dari database
  const startTime = new Date(ujian.startUjian);
  const endTime = new Date(ujian.endUjian);
  
  // Calculate duration in minutes
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  if (!isStarted) {
    return (
      <>
        <div className="min-h-screen p-4 sm:p-6 space-y-6 bg-gray-50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/siswa/ujian")}
            >
              <ArrowLeft className="w-5 h-5" weight="bold" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{ujian.judul}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{ujian.mapel}</p>
            </div>
          </div>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Informasi Ujian</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Waktu Mulai</p>
                    <p className="font-semibold">
                      {format(startTime, "dd MMMM yyyy HH:mm", { locale: id })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Waktu Berakhir</p>
                    <p className="font-semibold">
                      {format(endTime, "dd MMMM yyyy HH:mm", { locale: id })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Durasi</p>
                    <p className="font-semibold">{durationMinutes} menit</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Soal</p>
                    <p className="font-semibold">{ujian.totalSoal} soal</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jenis Soal</p>
                    <p className="font-semibold">{soalPG.length} PG • {soalEssay.length} Essay</p>
                  </div>
                </div>
              </div>

              {ujian.deskripsi && (
                <div>
                  <h3 className="font-semibold mb-2">Deskripsi</h3>
                  <MathRenderer content={ujian.deskripsi} className="text-muted-foreground" />
                </div>
              )}

              <div className="pt-4 border-t">
                <Button
                  onClick={handleStartExam}
                  className="w-full"
                  size="lg"
                >
                  <LockKey className="w-5 h-5 mr-2" weight="fill" />
                  Mulai Ujian
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Masukkan Token Ujian</DialogTitle>
              <DialogDescription>
                Masukkan token 6-digit yang diberikan oleh admin untuk memulai ujian
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="token">Token Ujian</Label>
                <Input
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <Button
                onClick={handleValidateToken}
                disabled={isValidatingToken}
                className="w-full"
              >
                {isValidatingToken ? "Memvalidasi..." : "Mulai Ujian"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-gray-50 flex flex-col">
      {/* Header Bar - Sticky di atas */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between p-3 sm:p-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold truncate">{ujian.judul}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Soal {safeCurrentQuestion + 1} dari {allQuestions.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Queue Status Indicator */}
            {(queueStatus.saving > 0 || queueStatus.pending > 0 || queueStatus.failed > 0) && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-xs">
                {queueStatus.saving > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <CircleNotch className="w-3 h-3 animate-spin" />
                    {queueStatus.saving}
                  </span>
                )}
                {queueStatus.pending > 0 && (
                  <span className="text-yellow-600">⏸️ {queueStatus.pending}</span>
                )}
                {queueStatus.failed > 0 && (
                  <span className="text-red-600">❌ {queueStatus.failed}</span>
                )}
              </div>
            )}
            <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg ${
              timeRemaining < 300 ? 'bg-red-50' : 'bg-orange-50'
            }`}>
              <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${timeRemaining < 300 ? 'text-red-600' : 'text-orange-600'}`} weight="fill" />
              <span className={`font-mono font-bold text-sm sm:text-base ${
                timeRemaining < 300 ? 'text-red-600' : 'text-orange-600'
              }`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
            <div>
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-sm sm:text-base">
                  {currentQuestion + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    {isPG ? "Pilihan Ganda" : "Essay"}
                  </p>
                  <MathRenderer content={currentQ.pertanyaan || ""} className="text-base sm:text-lg" />
                </div>
              </div>

              {isPG ? (
                <>
                  <RadioGroup
                    value={answers[currentQ.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQ.id, value, 'multiple_choice')}
                    className="space-y-2 sm:space-y-3"
                  >
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <div key={option} className="flex items-start space-x-3 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <RadioGroupItem value={option} id={`${currentQ.id}-${option}`} className="mt-1" />
                        <Label htmlFor={`${currentQ.id}-${option}`} className="flex-1 cursor-pointer">
                          <span className="font-semibold mr-2">{option}.</span>
                          <MathRenderer content={currentQ[`opsi${option}`] || ""} className="inline text-sm sm:text-base" />
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {/* Save status indicator for PG */}
                  {answers[currentQ.id] && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      {saveStatus[currentQ.id] === 'saving' && (
                        <>
                          <CircleNotch className="w-3 h-3 animate-spin text-blue-600" />
                          <span>Menyimpan...</span>
                        </>
                      )}
                      {saveStatus[currentQ.id] === 'saved' && (
                        <>
                          <FloppyDisk className="w-3 h-3 text-green-600" weight="fill" />
                          <span>Tersimpan</span>
                          {lastSaved[currentQ.id] && (
                            <span className="text-muted-foreground">
                              • {format(lastSaved[currentQ.id], "HH:mm:ss")}
                            </span>
                          )}
                        </>
                      )}
                      {saveStatus[currentQ.id] === 'error' && (
                        <>
                          <Warning className="w-3 h-3 text-red-600" weight="fill" />
                          <span>Gagal menyimpan</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Foto Jawaban (jika ada) - Ditampilkan di atas */}
                  {essayImages[currentQ.id] && (
                    <div className="mb-4">
                      <div className="relative border-2 border-blue-200 rounded-lg p-3 bg-blue-50/30">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                            <ImageSquare className="w-4 h-4" weight="fill" />
                            Foto Jawaban
                          </Label>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => openCameraModal(currentQ.id)}
                            >
                              <Camera className="w-3 h-3 mr-1" />
                              Ganti
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => {
                                const newImages = { ...essayImages };
                                delete newImages[currentQ.id];
                                setEssayImages(newImages);
                                // Update localStorage
                                try {
                                  localStorage.setItem(getImagesStorageKey(), JSON.stringify(newImages));
                                } catch (error) {
                                  console.error('Error updating localStorage:', error);
                                }
                                toast.success('Foto jawaban dihapus');
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <img
                          src={essayImages[currentQ.id]}
                          alt="Jawaban essay"
                          className="w-full h-auto rounded-lg border-2 border-white shadow-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tombol Ambil Foto (jika belum ada foto) */}
                  {!essayImages[currentQ.id] && (
                    <div className="mb-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openCameraModal(currentQ.id)}
                        className="w-full sm:w-auto"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Ambil Foto Jawaban
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload foto lembar jawaban Anda (opsional)
                      </p>
                    </div>
                  )}

                  {/* Text Area - Selalu ditampilkan */}
                  <div className="space-y-2">
                    <Label htmlFor={`essay-${currentQ.id}`} className="text-sm font-semibold">
                      {essayImages[currentQ.id] ? 'Catatan Tambahan (Opsional)' : 'Jawaban Tulisan'}
                    </Label>
                    <Textarea
                      id={`essay-${currentQ.id}`}
                      value={answers[currentQ.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, 'essay')}
                      onPaste={(e) => {
                        // Trigger immediate save on paste
                        setTimeout(() => {
                          const newValue = (e.currentTarget as HTMLTextAreaElement).value;
                          handleAnswerChange(currentQ.id, newValue, 'essay');
                          // Save immediately after paste
                          setTimeout(() => {
                            saveAnswerToQueue(currentQ.id, 'essay', newValue);
                          }, 500);
                        }, 0);
                      }}
                      placeholder={essayImages[currentQ.id] 
                        ? "Tulis catatan atau penjelasan tambahan di sini (opsional)..."
                        : "Tulis jawaban Anda di sini..."
                      }
                      rows={essayImages[currentQ.id] ? 4 : 8}
                      className="text-sm sm:text-base"
                    />
                  </div>

                  {/* Save status indicator for Essay */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    {saveStatus[currentQ.id] === 'typing' && (
                      <>
                        <CircleNotch className="w-3 h-3 animate-spin text-blue-600" />
                        <span>Mengetik... (auto-save dalam 3 detik)</span>
                      </>
                    )}
                    {saveStatus[currentQ.id] === 'saving' && (
                      <>
                        <CircleNotch className="w-3 h-3 animate-spin text-blue-600" />
                        <span>Menyimpan...</span>
                      </>
                    )}
                    {saveStatus[currentQ.id] === 'saved' && (
                      <>
                        <FloppyDisk className="w-3 h-3 text-green-600" weight="fill" />
                        <span>Tersimpan</span>
                        {lastSaved[currentQ.id] && (
                          <span className="text-muted-foreground">
                            • {format(lastSaved[currentQ.id], "HH:mm:ss")}
                          </span>
                        )}
                        <span className="text-muted-foreground">• Auto-save setiap 15 detik</span>
                      </>
                    )}
                    {saveStatus[currentQ.id] === 'error' && (
                      <>
                        <Warning className="w-3 h-3 text-red-600" weight="fill" />
                        <span>Gagal menyimpan (tersimpan di browser)</span>
                      </>
                    )}
                  </div>
                </>
              )}
          </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion(Math.max(0, safeCurrentQuestion - 1))}
                disabled={safeCurrentQuestion === 0}
                className="w-full sm:w-auto"
                size="sm"
              >
                Sebelumnya
              </Button>

              {safeCurrentQuestion === allQuestions.length - 1 ? (
                <Button 
                  onClick={handleSubmitClick}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                  size="sm"
                >
                  <CheckCircle className="w-4 h-4 mr-2" weight="fill" />
                  {isSubmitting ? "Mengumpulkan..." : "Kumpulkan Ujian"}
                </Button>
              ) : (
                <Button 
                  onClick={() => setCurrentQuestion(Math.min(allQuestions.length - 1, safeCurrentQuestion + 1))}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  Selanjutnya
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Navigasi Soal</h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {allQuestions.map((q, idx) => (
                <Button
                  key={q.id}
                  variant={idx === safeCurrentQuestion ? "default" : answers[q.id] ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentQuestion(idx)}
                  className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                >
                  {idx + 1}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-primary bg-primary"></div>
                <span>Sedang dikerjakan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-secondary bg-secondary"></div>
                <span>Sudah dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2"></div>
                <span>Belum dijawab</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

      {/* Modal Konfirmasi Submit */}
      <AlertDialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <AlertDialogContent className="z-[10000]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" weight="fill" />
              Konfirmasi Pengumpulan Ujian
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2 text-muted-foreground text-sm">
                <p>Apakah Anda yakin ingin mengumpulkan ujian ini?</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Ringkasan Jawaban:</p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Total soal: {allQuestions.length}</li>
                    <li>• Sudah dijawab: {Object.keys(answers).filter(key => {
                      const answer = answers[key];
                      return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
                    }).length}</li>
                    <li>• Belum dijawab: {allQuestions.length - Object.keys(answers).filter(key => {
                      const answer = answers[key];
                      return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
                    }).length}</li>
                  </ul>
                </div>
                <p className="text-amber-600 font-medium text-sm mt-3">
                  ⚠️ Setelah dikumpulkan, Anda tidak dapat mengubah jawaban lagi.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Mengumpulkan..." : "Ya, Kumpulkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Error Validasi */}
      <AlertDialog open={showValidationError} onOpenChange={setShowValidationError}>
        <AlertDialogContent className="z-[10000]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Warning className="w-5 h-5" weight="fill" />
              Soal Belum Lengkap
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 whitespace-pre-line text-sm">
              {validationMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowValidationError(false);
                // Navigate to first unanswered question
                const { soalPG, soalEssay } = ujianData;
                const allQuestions = [...soalPG, ...soalEssay];
                const firstUnanswered = allQuestions.findIndex((q: any) => {
                  const answer = answers[q.id];
                  return !answer || (typeof answer === 'string' && answer.trim() === '');
                });
                if (firstUnanswered !== -1) {
                  setCurrentQuestion(firstUnanswered);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Lihat Soal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Camera Dialog for Essay Photo */}
      {/* Canvas tersembunyi untuk capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Modal Kamera - Live Preview WebRTC */}
      <Dialog open={showCameraModal} onOpenChange={(open) => {
        if (!open && !isUploadingPhoto) {
          handleCloseModal();
        }
      }}>
        <DialogPortal>
          <DialogOverlay className="z-[10000]" />
          <div className="fixed left-[50%] top-[50%] z-[10001] grid w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-3 sm:gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg sm:rounded-xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto touch-manipulation">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isUploadingPhoto}
              className="absolute right-2 top-2 sm:right-4 sm:top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10"
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="sr-only">Close</span>
            </button>
            
            <div className="flex flex-col gap-1.5 sm:gap-2 text-center sm:text-left pr-8 sm:pr-0">
              <h2 className="text-base sm:text-lg leading-tight font-semibold">
                {capturedPhoto ? 'Pratinjau Foto Jawaban' : 'Ambil Foto Jawaban'}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                {capturedPhoto 
                  ? 'Periksa foto Anda. Pastikan tulisan jelas terlihat.'
                  : 'Arahkan kamera ke lembar jawaban Anda.'
                }
              </p>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
            {/* Error Message */}
            {cameraError && !capturedPhoto && (
              <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md sm:rounded-lg">
                <p className="text-xs sm:text-sm text-red-800 dark:text-red-200 font-semibold mb-1">❌ Kamera Gagal Diakses</p>
                <p className="text-xs text-red-700 dark:text-red-300 leading-snug">{cameraError}</p>
              </div>
            )}

            {/* Video Live Stream atau Preview Foto */}
            <div className="relative w-full bg-black rounded-md sm:rounded-lg overflow-hidden touch-none select-none" style={{ aspectRatio: '4/3' }}>
              {capturedPhoto ? (
                // Preview foto yang sudah diambil
                <img 
                  src={capturedPhoto} 
                  alt="Preview foto jawaban" 
                  className="w-full h-full object-contain"
                />
              ) : (
                // Live video stream WebRTC
                <>
                  {!cameraError && (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Loading overlay */}
                  {cameraLoading && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="text-center text-white px-4">
                        <CircleNotch className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto mb-2 sm:mb-3" />
                        <p className="text-sm sm:text-base font-semibold">Memuat kamera...</p>
                        <p className="text-xs text-gray-300 mt-1">Mohon izinkan akses kamera</p>
                      </div>
                    </div>
                  )}

                  {/* Error overlay */}
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="text-center text-white px-4">
                        <Camera className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 opacity-50" />
                        <p className="text-sm">Kamera tidak tersedia</p>
                        <p className="text-xs text-gray-400 mt-2">Refresh halaman untuk coba lagi</p>
                      </div>
                    </div>
                  )}

                  {/* Crosshair/Guide untuk centering - Responsif */}
                  {!cameraLoading && !cameraError && !capturedPhoto && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 border-2 border-blue-500/30"></div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 border-2 border-blue-500/50 rounded-lg"></div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Buttons - Responsif untuk mobile */}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              {capturedPhoto ? (
                // Tombol untuk mode preview
                <>
                  <Button
                    variant="outline"
                    onClick={handleCloseModal}
                    disabled={isUploadingPhoto}
                    className="order-3 sm:order-1"
                  >
                    Batal
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRetakePhoto}
                    disabled={isUploadingPhoto}
                    className="order-2 sm:order-2"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Ambil Ulang
                  </Button>
                  <Button
                    onClick={handleConfirmPhoto}
                    disabled={isUploadingPhoto}
                    className="order-1 sm:order-3"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                        Mengupload...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" weight="fill" />
                        Gunakan Foto Ini
                      </>
                    )}
                  </Button>
                </>
              ) : (
                // Tombol untuk mode live camera
                <>
                  <Button
                    variant="outline"
                    onClick={handleCloseModal}
                    disabled={isUploadingPhoto}
                    className="order-2 sm:order-1"
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleCapturePhoto}
                    disabled={cameraLoading || !!cameraError}
                    size="lg"
                    className="order-1 sm:order-2 sm:min-w-[140px]"
                  >
                    {cameraLoading ? (
                      <>
                        <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                        Memuat...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mr-2" weight="fill" />
                        Ambil Foto
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
            
            {/* Info text - Responsif */}
            <div className="text-center px-2 sm:px-0">
              {capturedPhoto ? (
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                  Periksa dengan teliti. Klik "Ambil Ulang" jika foto kurang jelas.
                </p>
              ) : cameraLoading ? (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ⏳ Sedang meminta izin akses kamera...
                </p>
              ) : cameraError ? (
                <p className="text-xs sm:text-sm text-red-500 leading-snug">
                  Tutup modal dan coba lagi, atau refresh halaman jika masalah berlanjut.
                </p>
              ) : (
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    📷 Arahkan kamera ke lembar jawaban Anda
                  </p>
                  <p className="text-xs text-gray-500 leading-snug">
                    Pastikan pencahayaan cukup dan tulisan jelas terlihat
                  </p>
                </div>
              )}
            </div>
            </div>
          </div>
        </DialogPortal>
      </Dialog>
    </>
  );
}
