type FormattedDateProps = {
  date?: string;
};

export function FormattedDate({ date }: FormattedDateProps) {
  if (!date) return null;

  const dateObj = new Date(date);
  
  // Format as DD.MM.YY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);
  
  return <>{`${day}.${month}.${year}`}</>;
}

