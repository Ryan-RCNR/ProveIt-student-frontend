import { Check } from 'lucide-react'
import type { QuizQuestion as QuizQuestionType } from '../api/client'

interface QuizQuestionProps {
  question: QuizQuestionType
  index: number
  answer: string | undefined
  onAnswerChange: (questionId: string, value: string) => void
}

export function QuizQuestion({
  question,
  index,
  answer,
  onAnswerChange,
}: QuizQuestionProps) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-start gap-4 mb-4">
        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-ice/20 text-ice rounded-full font-semibold text-sm">
          {index + 1}
        </span>
        <div className="flex-1">
          <span className="text-xs text-gray-400 uppercase mb-2 block">
            {question.type === 'mc' ? 'Multiple Choice' : 'Short Answer'}
          </span>
          <p className="text-white text-lg">{question.question}</p>
        </div>
        {answer && (
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
        )}
      </div>

      {question.type === 'mc' && question.options ? (
        <div className="space-y-2 ml-12">
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                answer === opt.id
                  ? 'bg-ice/20 border border-ice/50'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={opt.id}
                checked={answer === opt.id}
                onChange={() => onAnswerChange(question.id, opt.id)}
                className="sr-only"
              />
              <span
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  answer === opt.id
                    ? 'border-ice bg-ice'
                    : 'border-gray-500'
                }`}
              >
                {answer === opt.id && (
                  <Check className="w-4 h-4 text-deep-sea" />
                )}
              </span>
              <span className="text-gray-300">{opt.text}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="ml-12">
          <textarea
            value={answer || ''}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            placeholder="Type your answer..."
            rows={3}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-ice focus:ring-1 focus:ring-ice focus:outline-none transition-colors resize-none"
          />
        </div>
      )}
    </div>
  )
}
