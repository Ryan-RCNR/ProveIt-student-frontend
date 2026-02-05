import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/proveit`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface OutlineField {
  label: string
  order: number
}

export interface VerifyCodeResponse {
  assignment_id: string
  assignment_name: string
  instructions: string | null
  outline_fields: OutlineField[]
  time_limit_minutes: number
  question_count: number
}

export interface QuizQuestion {
  id: string
  type: 'mc' | 'short'
  question: string
  options?: { id: string; text: string }[]
  points: number
}

export interface PaperSubmitResponse {
  submission_id: string
  quiz_questions: QuizQuestion[]
  time_limit_minutes: number
  started_at: string
}

export interface QuizSubmitResponse {
  status: string
  message: string
  submitted_at: string
}

export interface LockdownEvent {
  type: 'tab_switch' | 'copy_attempt' | 'paste_attempt' | 'fullscreen_exit' | 'window_blur'
  timestamp: string
  count: number
}

// API functions
export async function verifyCode(accessCode: string): Promise<VerifyCodeResponse> {
  const response = await api.post('/verify-code', { access_code: accessCode })
  return response.data
}

export async function submitPaper(
  assignmentId: string,
  studentName: string,
  paperText: string
): Promise<PaperSubmitResponse> {
  const response = await api.post('/submissions', {
    assignment_id: assignmentId,
    student_name: studentName,
    paper_text: paperText,
  })
  return response.data
}

export async function submitPaperFile(
  assignmentId: string,
  studentName: string,
  file: File
): Promise<PaperSubmitResponse> {
  const formData = new FormData()
  formData.append('assignment_id', assignmentId)
  formData.append('student_name', studentName)
  formData.append('file', file)

  const response = await api.post('/submissions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function submitQuiz(
  submissionId: string,
  answers: { question_id: string; answer: string }[],
  outlineResponses: { field_label: string; response: string }[],
  lockdownEvents: LockdownEvent[],
  wasForced: boolean = false
): Promise<QuizSubmitResponse> {
  const response = await api.post(`/submissions/${submissionId}/quiz`, {
    answers,
    outline_responses: outlineResponses,
    lockdown_events: lockdownEvents,
    was_forced: wasForced,
  })
  return response.data
}
