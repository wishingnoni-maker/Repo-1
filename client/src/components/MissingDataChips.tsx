interface MissingDataChipsProps {
  items: string[];
}

export function MissingDataChips({ items }: MissingDataChipsProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="chip-row">
      {items.map((item) => (
        <span key={item} className="data-chip data-chip--missing">
          {item}
        </span>
      ))}
    </div>
  );
}
