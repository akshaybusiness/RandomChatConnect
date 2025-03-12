import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { setupPeerConnection, closePeerConnection } from '../lib/webrtc';

interface UseWebRTCProps {
  partnerId: string;
  hasVideo: boolean;
}

export const useWebRTC = ({ partnerId, hasVideo }: UseWebRTCProps) => {
  const { wsRef } = useWebSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  // Initialize WebRTC when the component mounts
  useEffect(() => {
    // Only initialize video if enabled
    if (!hasVideo) return;
    
    let localStreamInstance: MediaStream | null = null;
    
    const initialize = async () => {
      try {
        // Get user media (camera and microphone)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamInstance = stream;
        setLocalStream(stream);
        
        // Setup WebRTC peer connection
        const { peerConnection, remoteStreamInstance } = await setupPeerConnection({
          localStream: stream,
          webSocket: wsRef.current!,
          partnerId
        });
        
        peerConnectionRef.current = peerConnection;
        setRemoteStream(remoteStreamInstance);
        
      } catch (error) {
        console.error('Error initializing WebRTC:', error);
      }
    };
    
    initialize();
    
    // Cleanup function
    return () => {
      if (localStreamInstance) {
        localStreamInstance.getTracks().forEach(track => track.stop());
      }
      
      if (peerConnectionRef.current) {
        closePeerConnection(peerConnectionRef.current);
      }
    };
  }, [partnerId, hasVideo, wsRef]);
  
  // Function to toggle microphone
  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = enabled;
        setIsMicMuted(!enabled);
      }
    }
  };
  
  // Function to toggle camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = enabled;
        setIsCameraOff(!enabled);
      }
    }
  };
  
  return {
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    toggleMic,
    toggleCamera
  };
};
