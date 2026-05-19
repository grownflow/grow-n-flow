import { useState } from 'react';
import './GillPopup.css';

function QuizMode({ quiz, onClose }) {
  const [selected, setSelected] = useState(null);
  const answered = selected !== null;
  const correct = answered && selected === quiz.correctIndex;

  return (
    <div className="popup quiz-popup">
      <div className="gill-header">
        <span className="gill-avatar">🐟</span>
        <h2>Gill wants to test you!</h2>
      </div>

      <p className="quiz-question">{quiz.question}</p>

      <div className="quiz-options">
        {quiz.options.map((opt, i) => {
          let cls = 'quiz-option';
          if (answered) {
            if (i === quiz.correctIndex) cls += ' quiz-option-correct';
            else if (i === selected) cls += ' quiz-option-wrong';
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => !answered && setSelected(i)}
              disabled={answered}
              type="button"
            >
              {opt}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className={`quiz-feedback ${correct ? 'quiz-feedback-correct' : 'quiz-feedback-wrong'}`}>
          <strong>{correct ? '✓ That\'s right!' : '✗ Not quite.'}</strong>
          <p>{quiz.explanation}</p>
          <button className="close-button" onClick={onClose} type="button">Got it!</button>
        </div>
      ) : (
        <button className="close-button quiz-skip" onClick={onClose} type="button">Skip</button>
      )}
    </div>
  );
}

function GillPopup({ gillText, active, onClose, inline = false, quiz = null }) {
  if (quiz && active) {
    return (
      <div className="overlay">
        <QuizMode quiz={quiz} onClose={onClose} />
      </div>
    );
  }

  if (inline) {
    return (
      <div className="popup">
        <h2>Gill's Advice</h2>
        <p>{gillText}</p>
        {onClose && (
          <button className="close-button" onClick={onClose} type="button">Close</button>
        )}
      </div>
    );
  }

  return (
    <div>
      {active && (
        <div className="overlay">
          <div className="popup">
            <h2>Gill's Advice</h2>
            <p>{gillText}</p>
            <button className="close-button" onClick={onClose} type="button">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GillPopup;
