import { useEffect, useState } from 'react';
import { Home } from './Home';
import { RoomPage } from './RoomPage';

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const f = () => setPath(location.pathname);
    window.addEventListener('popstate', f);
    window.addEventListener('navigate', f);
    return () => { window.removeEventListener('popstate', f); window.removeEventListener('navigate', f); };
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const m = path.match(/^\/r\/([A-Za-z0-9]+)/);
  return m ? <RoomPage id={m[1].toUpperCase()} /> : <Home />;
}
