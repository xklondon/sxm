export const MAGIC_8_CARD_ANSWERS = [
  'The deck says yes.',
  'The shoe is smiling.',
  'Dealer says: maybe.',
  'The felt has spoken.',
  'The cards are warming up.',
  'Signs point to hit.',
  'Signs point to stand.',
  'The odds look friendly.',
  'The table approves.',
  'Bank Bot looks nervous.',
  'Your chips believe in you.',
  'The next card has secrets.',
  'Ask again after the shuffle.',
  'Wait for the next hand.',
  'The deck is undecided.',
  'Reply hazy — cut the deck.',
  'Concentrate and ask the dealer.',
  'Risky, but stylish.',
  'Not tonight, my friend.',
  'The shoe says patience.',
  'The bank has other plans.',
  'Very doubtful.',
  "Don't count on it.",
  'No clear signal from the deck.',
  'Fortune says: emotionally hit.',
  'The river may know later.',
  'The dice are still thinking.',
  'Poker face required.',
  'Zilch energy detected.',
  'The table wants drama.',
] as const;

export function randomAnswer(previousAnswer?: string | null): string {
  const pool =
    previousAnswer && MAGIC_8_CARD_ANSWERS.length > 1
      ? MAGIC_8_CARD_ANSWERS.filter((answer) => answer !== previousAnswer)
      : MAGIC_8_CARD_ANSWERS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? MAGIC_8_CARD_ANSWERS[0];
}
