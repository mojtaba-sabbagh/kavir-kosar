// Format persian date
// @/lib/date-utils.tsx
  export function formatJalali(dateLike: string | number | Date, withTime = false) {
    try {
      const d = new Date(dateLike);
      const opts: Intl.DateTimeFormatOptions = withTime
        ? {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts).format(d);
    } catch {
      return String(dateLike ?? '');
    }
  }