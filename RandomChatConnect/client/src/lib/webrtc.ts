// Configuration for WebRTC, including STUN servers for NAT traversal
const RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

interface SetupPeerConnectionParams {
  localStream: MediaStream;
  webSocket: WebSocket;
  partnerId: string;
}

export async function setupPeerConnection({
  localStream,
  webSocket,
  partnerId
}: SetupPeerConnectionParams): Promise<{
  peerConnection: RTCPeerConnection;
  remoteStreamInstance: MediaStream;
}> {
  // Create a new RTCPeerConnection
  const peerConnection = new RTCPeerConnection(RTCConfig);
  
  // Create a new MediaStream for the remote video
  const remoteStreamInstance = new MediaStream();
  
  // Add all local tracks to the peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Set up event handlers for incoming tracks
  peerConnection.ontrack = (event) => {
    // Add incoming tracks to the remote stream
    event.streams[0].getTracks().forEach(track => {
      remoteStreamInstance.addTrack(track);
    });
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      // Send the ICE candidate to the peer via WebSocket
      webSocket.send(JSON.stringify({
        type: 'webrtc-ice-candidate',
        data: {
          candidate: event.candidate,
          partnerId
        }
      }));
    }
  };
  
  // Listen for WebSocket messages
  webSocket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'webrtc-offer':
        if (message.data.partnerId === partnerId) {
          // Set remote description from offer
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.offer));
          
          // Create answer
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          // Send answer to peer
          webSocket.send(JSON.stringify({
            type: 'webrtc-answer',
            data: {
              answer,
              partnerId
            }
          }));
        }
        break;
        
      case 'webrtc-answer':
        if (message.data.partnerId === partnerId) {
          // Set remote description from answer
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.answer));
        }
        break;
        
      case 'webrtc-ice-candidate':
        if (message.data.partnerId === partnerId) {
          // Add received ICE candidate
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
          } catch (e) {
            console.error('Error adding received ICE candidate', e);
          }
        }
        break;
    }
  });
  
  // Create and send offer to start the connection
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  webSocket.send(JSON.stringify({
    type: 'webrtc-offer',
    data: {
      offer,
      partnerId
    }
  }));
  
  return { peerConnection, remoteStreamInstance };
}

export function closePeerConnection(peerConnection: RTCPeerConnection) {
  // Close all transceivers
  if (peerConnection.getTransceivers) {
    peerConnection.getTransceivers().forEach(transceiver => {
      if (transceiver.stop) {
        transceiver.stop();
      }
    });
  }
  
  // Close the connection
  peerConnection.close();
}
