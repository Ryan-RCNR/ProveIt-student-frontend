import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Entry } from './pages/Entry'
import { Instructions } from './pages/Instructions'
import { PaperSubmit } from './pages/PaperSubmit'
import { LockdownQuiz } from './pages/LockdownQuiz'
import { Confirmation } from './pages/Confirmation'

function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/submit" element={<PaperSubmit />} />
        <Route path="/quiz" element={<LockdownQuiz />} />
        <Route path="/complete" element={<Confirmation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
