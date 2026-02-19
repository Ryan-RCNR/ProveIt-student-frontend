import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/proveit`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Student session token management
let studentToken: string | null = null

export function setStudentToken(token: string | null) {
  studentToken = token
  if (token) {
    sessionStorage.setItem('proveit_student_token', token)
  } else {
    sessionStorage.removeItem('proveit_student_token')
  }
}

export function getStudentToken(): string | null {
  if (!studentToken) {
    studentToken = sessionStorage.getItem('proveit_student_token')
  }
  return studentToken
}

// Request interceptor to attach student token
api.interceptors.request.use((config) => {
  const token = getStudentToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token and let the app handle re-authentication
      setStudentToken(null)
      console.warn('Student session expired or invalid')
    }
    return Promise.reject(error)
  }
)

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
  require_entry_approval: boolean
}

export interface EntryRequestResponse {
  entry_request_id: string
  status: 'pending' | 'approved' | 'denied'
  assignment_name: string
  student_name: string
}

export interface EntryRequestStatusResponse {
  entry_request_id: string
  status: 'pending' | 'approved' | 'denied'
  assignment_id?: string
  assignment_name?: string
  instructions?: string | null
  outline_fields?: OutlineField[]
  time_limit_minutes?: number
  question_count?: number
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
  session_token: string
  quiz_status: string
}

export interface QuizReadyResponse {
  submission_id: string
  quiz_status: 'generating' | 'ready' | 'failed'
  quiz_questions?: QuizQuestion[]
  time_limit_minutes?: number
  started_at?: string
}

export interface QuizSubmitResponse {
  status: string
  message: string
  submitted_at: string
}

export interface LockdownEvent {
  type: 'tab_switch' | 'copy_attempt' | 'paste_attempt' | 'fullscreen_exit' | 'window_blur' | 'cut_attempt' | 'drop_attempt' | 'devtools_attempt'
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
  sessionToken: string,
  answers: { question_id: string; answer: string }[],
  outlineResponses: { field_label: string; response: string }[],
  lockdownEvents: LockdownEvent[],
  wasForced: boolean = false,
  lockdownForced: boolean = false
): Promise<QuizSubmitResponse> {
  const response = await api.post(`/submissions/${submissionId}/quiz`, {
    session_token: sessionToken,
    answers,
    outline_responses: outlineResponses,
    lockdown_events: lockdownEvents,
    was_forced: wasForced,
    lockdown_forced: lockdownForced,
  })
  return response.data
}

/**
 * Submit quiz for forced/lockdown submits.
 * The backend saves answers + status immediately and returns the response
 * before AI grading starts (AI runs in a background task). This means
 * the response arrives in <1s, so we can safely await it and navigate
 * without risk of the student closing the tab before the data is saved.
 */
export async function submitQuizForced(
  submissionId: string,
  sessionToken: string,
  answers: { question_id: string; answer: string }[],
  outlineResponses: { field_label: string; response: string }[],
  lockdownEvents: LockdownEvent[],
  wasForced: boolean,
  lockdownForced: boolean
): Promise<void> {
  await api.post(`/submissions/${submissionId}/quiz`, {
    session_token: sessionToken,
    answers,
    outline_responses: outlineResponses,
    lockdown_events: lockdownEvents,
    was_forced: wasForced,
    lockdown_forced: lockdownForced,
  })
}

export async function requestEntry(
  accessCode: string,
  studentName: string
): Promise<EntryRequestResponse> {
  const response = await api.post('/entry-requests', {
    access_code: accessCode,
    student_name: studentName,
  })
  return response.data
}

export async function pollEntryStatus(
  entryRequestId: string
): Promise<EntryRequestStatusResponse> {
  const response = await api.get(`/entry-requests/${entryRequestId}/status`)
  return response.data
}

export async function pollQuizReady(
  submissionId: string
): Promise<QuizReadyResponse> {
  const response = await api.get(`/submissions/${submissionId}/quiz-ready`)
  return response.data
}

export async function reportLockdownEvent(
  submissionId: string,
  sessionToken: string,
  eventType: LockdownEvent['type']
): Promise<void> {
  // Fire-and-forget -- don't block the UI or fail the quiz if this call fails
  await api.post(`/submissions/${submissionId}/lockdown-event`, {
    session_token: sessionToken,
    event_type: eventType,
  })
}
