import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { api } from './lib/api.js';
import { StudentProvider } from './lib/student.jsx';
import { TopBar } from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Hub from './pages/Hub.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const [program, setProgram] = useState(null);

  useEffect(() => {
    api.program().then(setProgram).catch(() => setProgram(null));
  }, []);

  return (
    <StudentProvider>
      <div className="flex min-h-screen flex-col">
        <TopBar program={program} />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Hub program={program} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer program={program} />
      </div>
    </StudentProvider>
  );
}
