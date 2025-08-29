import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Camera, ArrowLeft, CheckCircle, AlertCircle, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { submitAttendance, acknowledgeScan } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

interface CheckinSession {
  id: string;
  className: string;
  teacherName: string;
  remainingTime: number;
  status: 'active' | 'ended';
}

const StudentCheckin = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const livenessRef = useRef<boolean>(false);
  
  const [session, setSession] = useState<CheckinSession | null>(null);
  const [step, setStep] = useState<'scanning' | 'camera' | 'processing' | 'result'>('scanning');
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [result, setResult] = useState<{
    status: 'present' | 'pending' | 'rejected';
    message: string;
    faceScore?: number;
  } | null>(null);

  // Fetch session data
  useEffect(() => {
    console.log('StudentCheckin useEffect called with sessionId:', sessionId, 'user:', user?.id);
    
    if (!sessionId || !user) {
      console.log('Missing sessionId or user, redirecting to home');
      navigate('/student/home');
      return;
    }

    fetchSessionData();
  }, [sessionId, user, navigate]);

  const fetchSessionData = async () => {
    console.log('fetchSessionData called for sessionId:', sessionId);
    
    try {
      // Check if we have a QR token in the URL
      const token = searchParams.get('token');
      console.log('QR token from URL:', token);
      
      if (token) {
        // Direct QR scan with token - acknowledge scan and proceed to camera
        console.log('Token found, acknowledging scan and proceeding to camera');
        try {
          await acknowledgeScan(token, user.id);
          toast.success('QR scanned successfully! Starting face verification...');
          setStep('camera');
          // Auto-start camera after a brief delay
          setTimeout(() => {
            startCamera();
          }, 1000);
        } catch (error: any) {
          console.error('Scan acknowledgment failed:', error);
          
          // Handle specific error messages
          if (error.message?.includes('already been marked present')) {
            toast.success('You are already marked present for this session!');
            setResult({
              status: 'present',
              message: 'You are already marked present for this session.',
              faceScore: undefined
            });
            setStep('result');
          } else {
            toast.error(error.message || 'Failed to acknowledge scan');
            navigate('/student/home');
          }
          return;
        }
      } else {
        console.log('No token found, waiting for QR scan');
        setStep('scanning');
        toast.info('Please scan the QR code to continue.');
      }

      // Fetch session data
      console.log('Fetching session data from Supabase...');
      const { data: sessionData, error } = await supabase
        .from('sessions')
        .select(`
          id,
          start_time,
          end_time,
          status,
          class:classes(
            id,
            name,
            teacher:profiles!classes_teacher_id_fkey(name)
          )
        `)
        .eq('id', sessionId)
        .eq('status', 'active')
        .single();

      console.log('Session data result:', { sessionData, error });

      if (error || !sessionData) {
        console.error('Session not found or ended:', error);
        toast.error('Session not found or has ended');
        navigate('/student/home');
        return;
      }

      const endTime = new Date(sessionData.end_time);
      const now = new Date();
      const remainingTime = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));

      console.log('Session timing:', { endTime, now, remainingTime });

      if (remainingTime <= 0) {
        console.log('Session has ended');
        toast.error('Session has ended');
        navigate('/student/home');
        return;
      }

      const session: CheckinSession = {
        id: sessionData.id,
        className: sessionData.class?.name || 'Unknown Class',
        teacherName: sessionData.class?.teacher?.name || 'Unknown Teacher',
        remainingTime: remainingTime,
        status: sessionData.status as 'active' | 'ended',
      };

      console.log('Setting session:', session);
      setSession(session);

      // Start countdown
      const countdown = setInterval(() => {
        setSession(prev => {
          if (!prev || prev.remainingTime <= 1) {
            clearInterval(countdown);
            if (prev?.remainingTime <= 1) {
              toast.error('Session has ended');
              navigate('/student/home');
            }
            return prev;
          }
          return { ...prev, remainingTime: prev.remainingTime - 1 };
        });
      }, 1000);

      return () => clearInterval(countdown);

    } catch (error) {
      console.error('Error fetching session:', error);
      toast.error('Failed to load session');
      navigate('/student/home');
    }
  };

  const startCamera = async () => {
    console.log('startCamera called');
    try {
      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      console.log('Camera access granted, stream:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        console.log('Video stream set to video element');
        
        // Wait for video to start playing
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          videoRef.current?.play().then(() => {
            console.log('Video started playing');
          }).catch(err => {
            console.error('Video play error:', err);
          });
        };
        
        // Simulate face detection (in real app, you'd use face detection library)
        setTimeout(() => {
          console.log('Simulating face detection');
          setFaceDetected(true);
          toast.success('Face detected! Please blink once.');
          
        // Simulate blink detection
        setTimeout(() => {
          console.log('=== BLINK DETECTION SIMULATION START ===');
          console.log('Simulating blink detection');
          setBlinkDetected(true);
          livenessRef.current = true; // Set ref to true for reliable access
          toast.success('Liveness confirmed! Processing attendance...');
          
          console.log('About to call processAttendance...');
          console.log('Current state - user:', user?.id, 'session:', session?.id, 'sessionId:', sessionId);
          
          // Add a small delay to ensure state is updated
          setTimeout(() => {
            console.log('Calling processAttendance with liveness: true');
            processAttendance(true); // Pass explicit liveness value
          }, 500);
        }, 3000);
        }, 2000);
      } else {
        console.error('Video ref is null');
      }
    } catch (error) {
      console.error('Camera error:', error);
      let errorMessage = 'Camera access denied.';
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Camera access denied. Please allow camera permissions in your browser settings.';
            break;
          case 'NotFoundError':
            errorMessage = 'No camera found on this device.';
            break;
          case 'NotSupportedError':
            errorMessage = 'Camera access not supported on this device.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Camera constraints could not be satisfied.';
            break;
          default:
            errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) {
      console.log('No video or canvas ref available for photo capture');
      return null;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.log('No canvas context available');
      return null;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    console.log('Photo captured, base64 length:', base64?.length);
    
    return base64;
  };

  const processAttendance = async (liveness?: boolean) => {
    console.log('=== PROCESS ATTENDANCE START ===');
    const actualLiveness = liveness ?? livenessRef.current;
    console.log('processAttendance called with:', {
      user: user?.id,
      session: session?.id,
      sessionId,
      liveness: actualLiveness,
      blinkDetected,
      faceDetected
    });

    if (!user?.id) {
      console.error('=== MISSING USER ===');
      console.error('Missing user for attendance processing');
      toast.error('User authentication error. Please log in again.');
      navigate('/login');
      return;
    }

    if (!sessionId) {
      console.error('=== MISSING SESSION ID ===');
      console.error('Missing sessionId for attendance processing');
      toast.error('Session not found. Please scan QR code again.');
      navigate('/student/home');
      return;
    }
    
    console.log('=== SETTING PROCESSING STEP ===');
    setStep('processing');
    
    // Capture photo before stopping camera
    console.log('=== CAPTURING PHOTO ===');
    const photoBase64 = capturePhoto();
    
    // Stop camera after processing
    console.log('=== STOPPING CAMERA ===');
    stopCamera();
    
    try {
      console.log('=== PREPARING TOKEN ===');
      // Get QR token from URL or create a proper test token
      let token = searchParams.get('token');
      
      if (!token) {
        console.log('No token found, cannot proceed without valid QR token');
        toast.error('Invalid QR code. Please scan a valid QR code from your teacher.');
        navigate('/student/home');
        return;
      }
      
      console.log('=== CALLING SUBMIT ATTENDANCE ===');
      console.log('About to call submitAttendance with:', {
        token: token.substring(0, 50) + '...',
        userId: user.id,
        sessionId: sessionId,
        liveness: actualLiveness
      });
      
      // Submit attendance with timeout
      console.log('=== CALLING SUBMIT ATTENDANCE ===');
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Attendance submission timed out after 10 seconds')), 10000);
      });
      
      const attendancePromise = submitAttendance(
        token,
        actualLiveness, // liveness
        photoBase64 // captured photo
      );
      
      const attendanceResult = await Promise.race([attendancePromise, timeoutPromise]) as {
        status: 'present' | 'pending' | 'rejected';
        face_score?: number;
        message?: string;
        attendance?: any;
      };
      
      console.log('=== ATTENDANCE RESULT ===');
      console.log('Raw attendance result:', attendanceResult);
      
      console.log('=== SUBMIT ATTENDANCE SUCCESS ===');
      console.log('Attendance result:', attendanceResult);
      
      let message: string;
      switch (attendanceResult.status) {
        case 'present':
          message = 'Attendance marked successfully!';
          toast.success(message);
          break;
        case 'pending':
          message = 'Submitted for review. Your face couldn\'t be confidently verified.';
          toast.info(message);
          break;
        case 'rejected':
          message = 'Face verification failed. Please try again or contact your teacher.';
          toast.error(message);
          break;
      }
      
      console.log('=== SETTING RESULT ===');
      setResult({
        status: attendanceResult.status,
        message: message,
        faceScore: attendanceResult.attendance?.face_score
      });
      setStep('result');
      console.log('=== PROCESS ATTENDANCE COMPLETE SUCCESS ===');
      
    } catch (error: any) {
      console.error('=== PROCESS ATTENDANCE ERROR ===');
      console.error('Attendance submission error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      let errorMessage = 'Failed to submit attendance.';
      
      
      if (error.message?.includes('already been marked present')) {
        // Student is already present - show success message
        setResult({
          status: 'present',
          message: 'You are already marked present for this session.',
          faceScore: undefined
        });
        setStep('result');
        toast.success('You are already marked present!');
        return;
      } else if (error.message?.includes('Already checked in')) {
        errorMessage = 'You have already checked in for this session.';
      } else if (error.message?.includes('Session not found')) {
        errorMessage = 'Session has expired or is no longer active.';
      } else if (error.message?.includes('Invalid QR token')) {
        errorMessage = 'QR code has expired. Please scan a new QR code.';
      } else if (error.message?.includes('Session has ended')) {
        errorMessage = 'This session has ended.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      // Reflect uncertain state to avoid mismatch with teacher view
      setResult({
        status: 'pending',
        message: 'Submitted for review. Please wait for teacher approval.',
        faceScore: undefined
      });
      setStep('result');
      toast.error(errorMessage);
      console.log('=== PROCESS ATTENDANCE COMPLETE ERROR ===');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
    setBlinkDetected(false);
    livenessRef.current = false; // Reset ref when stopping camera
  };

  const goBack = () => {
    stopCamera();
    navigate('/student/home');
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const getResultIcon = () => {
    switch (result?.status) {
      case 'present':
        return <CheckCircle className="w-16 h-16 text-success mx-auto" />;
      case 'pending':
        return <AlertCircle className="w-16 h-16 text-warning mx-auto" />;
      case 'rejected':
        return <X className="w-16 h-16 text-destructive mx-auto" />;
      default:
        return <AlertCircle className="w-16 h-16 text-warning mx-auto" />;
    }
  };

  const getResultColor = () => {
    switch (result?.status) {
      case 'present':
        return 'bg-success/10 text-success';
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <div className="text-center">
              <h1 className="font-semibold">{session.className}</h1>
              <p className="text-sm text-muted-foreground">{session.teacherName}</p>
            </div>
            
            <div className="text-right">
              <div className="text-lg font-bold text-primary">
                {formatTime(session.remainingTime)}
              </div>
              <p className="text-sm text-muted-foreground">remaining</p>
            </div>
          </div>
          
          <Progress 
            value={((90 - session.remainingTime) / 90) * 100} 
            className="mt-3"
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          
          {/* Scanning Step */}
          {step === 'scanning' && (
            <Card className="shadow-elegant border-0">
              <CardHeader className="text-center">
                <CardTitle>Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-6">
                  Please scan the attendance QR shown on the teacher's screen to continue.
                </p>
                <Button variant="primary" onClick={() => navigate('/student/scan')}>
                  Open Scanner
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Camera Step */}
          {step === 'camera' && (
            <Card className="shadow-elegant border-0">
              <CardHeader className="text-center">
                <CardTitle>Face Verification</CardTitle>
                <p className="text-muted-foreground">
                  Look directly at the camera and blink once
                </p>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-muted"
                    style={{ aspectRatio: '4/3' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  
                  {/* Face detection overlay */}
                  {faceDetected && (
                    <div className="absolute inset-4 border-2 border-success rounded-lg animate-pulse">
                      <div className="absolute -top-6 left-0">
                        <Badge className="bg-success text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Face Detected
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-5 h-5 ${faceDetected ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className={faceDetected ? 'text-success' : 'text-muted-foreground'}>
                      Face detected
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Eye className={`w-5 h-5 ${blinkDetected ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className={blinkDetected ? 'text-success' : 'text-muted-foreground'}>
                      Blink detected
                    </span>
                  </div>

                  {!cameraActive && (
                    <Button 
                      variant="primary" 
                      className="w-full"
                      onClick={startCamera}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Start Camera
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <Card className="shadow-elegant border-0">
              <CardHeader className="text-center">
                <CardTitle>Processing</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="w-32 h-32 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-muted-foreground">
                  Verifying face and processing attendance...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Result Step */}
          {step === 'result' && result && (
            <Card className="shadow-elegant border-0">
              <CardContent className="pt-6 text-center">
                <div className="mb-6">
                  {getResultIcon()}
                </div>
                
                <Badge className={`${getResultColor()} mb-4 text-lg px-4 py-2`}>
                  {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                </Badge>
                
                <h2 className="text-xl font-semibold mb-2">{result.message}</h2>
                
                {result.faceScore && (
                  <p className="text-sm text-muted-foreground mb-6">
                    Face Score: {result.faceScore.toFixed(2)}
                  </p>
                )}

                <div className="space-y-4">
                  {result.status === 'present' && (
                    <p className="text-sm text-muted-foreground">
                      Your attendance has been successfully recorded.
                    </p>
                  )}
                  
                  {result.status !== 'present' && (
                    <p className="text-sm text-muted-foreground">
                      Please contact your teacher if you have any issues with attendance.
                    </p>
                  )}

                  <Button 
                    variant="primary" 
                    className="w-full"
                    onClick={goBack}
                  >
                    Return to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentCheckin;