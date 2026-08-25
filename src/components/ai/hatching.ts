/**
 * Die Schraffur der ungeprüften Fläche.
 *
 * > [!important] Sie trägt eine Sicherheitsaussage, nicht eine Verzierung.
 * > Der Entwurf verlangt für einen ungeprüften Vorschlag **drei** Träger:
 * > Schraffur, orange Kante, Beschriftung. Nie die Farbe allein -- wer sie
 * > nicht unterscheidet, muss den Vorschlag trotzdem als solchen erkennen.
 * >
 * > Als Klasse liesse sich das nicht ausdrücken: Tailwind erzeugt keine
 * > Utility für einen `repeating-linear-gradient`, und ein beliebiger Wert in
 * > eckigen Klammern mit Kommas darin ist schlecht lesbar und leicht falsch
 * > abgeschrieben. Eine Stelle, an der die Schraffur definiert ist, ist
 * > besser als vier Aufrufstellen, von denen eine abweicht.
 *
 * Die Farben kommen aus den Tokens, damit sie beim Dunkelmodus mitwandern.
 */
export const HATCHING = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--color-ai-soft) 0 8px, var(--color-ai-soft-2) 8px 16px)",
} as const;
