import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import VideoTile from './VideoTile';
import './App.css';

const SERVER = 'http://localhost:8000';

function App() {
  const [streams, setStreams] = useState([]);
  const [socket, setSocket] = useState(null);
  const [syncInfo, setSyncInfo] = useState({ serverStart: Date.now(), liveLag: 2.5 });

  useEffect(() => {
    // fetch streams
    fetch(`${SERVER}/streams`).then(res => res.json()).then(data => {
      setStreams(data.streams);
      setSyncInfo(prev => ({ ...prev, serverStart: data.serverStart }));
    });

    const s = io(SERVER);
    setSocket(s);

    s.on('server-info', (d) => {
      setSyncInfo(prev => ({ ...prev, serverStart: d.serverStart }));
    });

    return () => s.disconnect();
  }, []);

   return (
    <div className="App">
      <h2>Video Streaming Dashboard Assignment — {streams.length} streams</h2>
      <div className="grid">
        {streams.map((st) => (
          <VideoTile 
            key={st.id} 
            id={st.id} 
            streamUrl={st.url}
            socket={socket} 
            syncInfo={syncInfo}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
