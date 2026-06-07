import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { getMagic8Wisdom, type Magic8GameType } from '../../content/magic8';
import { getShakeCooldownMs, useShakeDetector } from './useShakeDetector';
import './Magic8Ball.css';

export type Magic8BallProps = {
  variant: 'login' | 'table';
  disabled?: boolean;
  canShake?: boolean;
  compact?: boolean;
  /** Table felt overlay — ball + answer in top-left zone. */
  controlOnly?: boolean;
  /** Wisdom pool; defaults to blackjack on table variant, global on login. */
  gameType?: Magic8GameType;
  answer?: string | null;
  onAnswer?: (answer: string | null) => void;
};

const ANSWER_DELAY_MS = 500;
const TABLE_ANSWER_PREFIXES = ['✨', '🎱', '🃏', '🔮'] as const;

export function Magic8TableAnswer({ answer }: { answer: string | null }) {
  const [prefix, setPrefix] = useState<(typeof TABLE_ANSWER_PREFIXES)[number]>('✨');

  useEffect(() => {
    if (!answer) {
      return;
    }
    const index = Math.floor(Math.random() * TABLE_ANSWER_PREFIXES.length);
    setPrefix(TABLE_ANSWER_PREFIXES[index] ?? '✨');
  }, [answer]);

  if (!answer) {
    return null;
  }

  return (
    <div
      key={answer}
      className="magic8-table-answer"
      aria-live="polite"
      title={answer}
    >
      <span className="magic8-table-answer__prefix" aria-hidden="true">
        {prefix}
      </span>
      <span className="magic8-table-answer__text">{answer}</span>
    </div>
  );
}

export function Magic8Ball({
  variant,
  disabled = false,
  canShake = true,
  compact = false,
  controlOnly = false,
  gameType,
  answer: controlledAnswer,
  onAnswer,
}: Magic8BallProps) {
  const wisdomGameType: Magic8GameType | undefined =
    gameType ?? (variant === 'table' ? 'blackjack' : undefined);
  const isMobile = useIsMobileViewport();
  const [internalAnswer, setInternalAnswer] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showAnswerInWindow, setShowAnswerInWindow] = useState(false);
  const shakeKey = useRef(0);
  const cooldownUntil = useRef(0);
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answer = controlledAnswer ?? internalAnswer;
  const showBubbleAnswer =
    Boolean(answer) && variant === 'login' && !controlOnly;
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
    } else if (controlOnly) {
      onAnswer?.(null);
    }

    shakeKey.current += 1;
    requestAnimationFrame(() => {
      setIsShaking(true);
      shakeTimer.current = setTimeout(() => {
        setIsShaking(false);
      }, ANSWER_DELAY_MS);
    });

    answerTimer.current = setTimeout(() => {
      const nextAnswer = getMagic8Wisdom({
        gameType: wisdomGameType,
        previousAnswer: answer,
      });
      commitAnswer(nextAnswer);
    }, ANSWER_DELAY_MS);
  }, [
    answer,
    clearTimers,
    commitAnswer,
    controlOnly,
    controlledAnswer,
    disabled,
    onAnswer,
    wisdomGameType,
  ]);

  const { requestMotionAccess } = useShakeDetector(
    isMobile && canShake && !disabled,
    shakeBall,
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (variant !== 'table' || !controlOnly || !answer || !onAnswer) {
      return;
    }
    const dismissOnButton = (event: Event) => {
      const btn = (event.target as Element | null)?.closest('button');
      if (!btn) {
        return;
      }
      onAnswer(null);
    };
    const root = document.querySelector('.bj-casino') ?? document;
    root.addEventListener('click', dismissOnButton, true);
    return () => root.removeEventListener('click', dismissOnButton, true);
  }, [variant, controlOnly, answer, onAnswer]);

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

  const orbButton = (
    <button
      type="button"
      className={[
        'magic8__orb',
        variant === 'table' && controlOnly ? 'magic8-ball' : '',
        isShaking ? 'magic8__orb--shaking' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
  );

  if (variant === 'table' && controlOnly) {
    return (
      <div className="magic8-table-zone" data-magic8-variant="table">
        {orbButton}
        <Magic8TableAnswer answer={answer} />
      </div>
    );
  }

  return (
    <div
      className={[
        'magic8',
        variant === 'login' ? 'magic8--login' : 'magic8--table',
        controlOnly ? 'magic8--control-only' : '',
        compact ? 'magic8--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-magic8-variant={variant}
    >
      <div className="magic8__controls">
        <div className="magic8__orb-wrap">{orbButton}</div>
        {!isMobile && variant === 'login' && (
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
