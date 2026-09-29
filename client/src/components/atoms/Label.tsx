/**
 * ATOMO: Label
 * Etiqueta de un campo. Se asocia al input por htmlFor + id.
 */
interface LabelProps {
  htmlFor: string;
  children: React.ReactNode;
}

export function Label({ htmlFor, children }: LabelProps) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}
