import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ROUTES } from './data/navigation';
import { hasSeenIntro } from './hooks/introSeen';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Experience } from './pages/Experience';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { ProjectDetail } from './pages/ProjectDetail';
import { Projects } from './pages/Projects';
import { Splash } from './pages/Splash';
import { Training } from './pages/Training';

/** À la racine : l'intro pour une première visite, l'accueil directement pour un visiteur qui l'a déjà vue. */
function Entry() {
  return hasSeenIntro() ? <Navigate to={ROUTES.home} replace /> : <Splash />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Entry />} />
      <Route path={ROUTES.intro} element={<Splash />} />
      <Route element={<Layout />}>
        <Route path={ROUTES.home} element={<Home />} />
        <Route path={ROUTES.projects} element={<Projects />} />
        <Route path={`${ROUTES.projects}/:slug`} element={<ProjectDetail />} />
        <Route path={ROUTES.about} element={<About />} />
        <Route path={ROUTES.experience} element={<Experience />} />
        <Route path={ROUTES.training} element={<Training />} />
        <Route path={ROUTES.contact} element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
