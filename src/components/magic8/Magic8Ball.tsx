import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { randomAnswer } from './answers';
import { getShakeCooldownMs, useShakeDetector } from './useShakeDetector';
import './Magic8Ball.css';

export type Magic8BallProps = {
  variant: 'login' | 'table';
  disabled?: boolean;
  canShake?: boolean;
  compact?: boolean;
  answer?: string;
  onAnswer?: (answer: string) => void;
};

const ANSWER_DELAY_MS = 500;

export function Magic8Ball({
  variant,
  disabled = false,
  canShake = true,
  compact = false,
  answer: controlledAnswer,
  onAnswer,
}: Magic8BallProps) {
  const isMobile = useIsMobileViewport();
  const [internalAnswer, setInternalAnswer] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showAnswerInWindow, setShowAnswerInWindow] = useState(false);
  const shakeKey = useRef(0);
  const cooldownUntil = useRef(0);
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answer = controlledAnswer ?? internalAnswer;
  const showBubbleAnswer = Boolean(answer) && (variant === 'login' || variant === 'table');
  const showWindowAnswer =
    variant === 'login' && Boolean(answer) && showAnswerInWindow && !isShaking && compact;

  const clearTimers = useCallback(() => {
    if (answerTimer.current) {
      clearTimeout(answerTimer.current);
      answerTimer.current = null;
    }
    if (shakeTimer.current) {
      clearTimeout(shakeTimer.current);
      shakeTimer.current = null;
    }
  }, []);

  const commitAnswer = useCallback(
    (nextAnswer: string) => {
      if (controlledAnswer === undefined) {
        setInternalAnswer(nextAnswer);
      }
      onAnswer?.(nextAnswer);
      if (variant === 'login' && compact) {
        setShowAnswerInWindow(true);
      }
    },
    [controlledAnswer, compact, onAnswer, variant],
  );

  const shakeBall = useCallback(() => {
    if (disabled) {
      return;
    }
    const now = Date.now();
    if (now < cooldownUntil.current) {
      return;
    }
    cooldownUntil.current = now + getShakeCooldownMs();

    clearTimers();
    setIsShaking(false);
    setShowAnswerInWindow(false);
    if (controlledAnswer === undefined) {
      setInternalAnswer(null);
    }

    shakeKey.current += 1;
    requestAnimationFrame(() => {
      setIsShaking(true);
      shakeTimer.current = setTimeout(() => {
        setIsShaking(false);
      }, ANSWER_DELAY_MS);
    });

    answerTimer.current = setTimeout(() => {
      const nextAnswer = randomAnswer(answer);
      commitAnswer(nextAnswer);
    }, ANSWER_DELAY_MS);
  }, [answer, clearTimers, commitAnswer, controlledAnswer, disabled]);

  const { requestMotionAccess } = useShakeDetector(
    isMobile && canShake && !disabled,
    shakeBall,
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  async function handleOrbActivate() {
    if (disabled) {
      return;
    }
    if (isMobile) {
      await requestMotionAccess();
    }
    shakeBall();
  }

  const buttonLabel = variant === 'login' ? 'Ask the 8 Ball' : 'Shake';

  return (
    <div
      className={[
        'magic8',
        variant === 'login' ? 'magic8--login' : 'magic8--table',
        compact ? 'magic8--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-magic8-variant={variant}
    >
      <div className="magic8__controls">
        <div className="magic8__orb-wrap">
          <button
            type="button"
            className={['magic8__orb', isShaking ? 'magic8__orb--shaking' : ''].filter(Boolean).join(' ')}
            onClick={() => void handleOrbActivate()}
            disabled={disabled}
            aria-label={buttonLabel}
            key={shakeKey.current}
          >
            <span className="magic8__window" aria-live="polite">
              {showWindowAnswer ? (
                <p className="magic8__answer-in-window">{answer}</p>
              ) : (
                <span className="magic8__idle" aria-hidden={isShaking}>
                  {variant === 'table' ? '8' : '🎱'}
                </span>
              )}
            </span>
          </button>
        </div>
        {!isMobile && (
          <button
            type="button"
            className="magic8__shake-btn"
            onClick={() => void handleOrbActivate()}
            disabled={disabled}
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {showBubbleAnswer && !(variant === 'login' && compact && showWindowAnswer) ? (
        <p className="magic8__answer-bubble" aria-live="polite">
          {answer}
        </p>
      ) : null}
    </div>
  );
}
