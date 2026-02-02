import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const book = await req.json();
  if (!book.title || !book.author || !book.price || !book.college_name) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  // Prevent blocked users from creating listings
    if (book.user_id) {
    const { data: blocked, error: blockedErr } = await supabaseAdmin
      .from('blocked_users')
      .select('id')
      .eq('user_id', book.user_id)
      .limit(1);
    if (!blockedErr && blocked && blocked.length > 0) {
      return new Response(JSON.stringify({ error: 'Your account is blocked from listing items.' }), { status: 403 });
    }
  }
  // Google Books API verification (ISBN first, then fallback)
  const normalize = (str: string) => (str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const stripSubtitlesRaw = (s: string) => (s || '').split(/[:\-–—]/)[0];

  const inputAuthorsRaw: string[] = String(book.author || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const inputAuthors = inputAuthorsRaw.map((a: string) => normalize(a));
  const normalizedInputTitle = normalize(book.title || '');
  const normalizedInputTitleNoSub = normalize(stripSubtitlesRaw(book.title || ''));

  let status: 'pending' | 'verified' | 'admin_review' = 'pending';
  let debugInfo: any = {
    isbnProvided: Boolean(book.isbn_primary || book.isbn_secondary),
    isbnMatch: false,
    gbIsbnItems: 0,
    isbnOriginal: book.isbn_primary || book.isbn_secondary || '',
    isbnSanitized: '',
    isbnTriedWithoutKey: false,
    usedFallback: false,
    gbFallbackItems: 0,
    fallbackTriedWithoutKey: false,
    titleExactMatch: false,
    titleLooseMatch: false,
    allAuthorsPresent: false,
    anyAuthorMatch: false,
    normalizedInputTitle,
    normalizedInputTitleNoSub,
    normalizedInputAuthors: inputAuthors,
  };

  try {
    const isbnCandidates = [book.isbn_primary, book.isbn_secondary].filter(Boolean);
    if (isbnCandidates.length > 0) {
      const rawIsbn = String(isbnCandidates[0] || '');
      const sanitizedIsbn = rawIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();
      debugInfo.isbnSanitized = sanitizedIsbn;

      let gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(sanitizedIsbn)}&maxResults=1&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY}`);
      let gbData = await gbRes.json();
      debugInfo.gbIsbnItems = gbData?.totalItems || 0;
      if (!gbData?.totalItems) {
        debugInfo.isbnTriedWithoutKey = true;
        gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(sanitizedIsbn)}&maxResults=1`);
        gbData = await gbRes.json();
        debugInfo.gbIsbnItems = gbData?.totalItems || 0;
      }
      if (gbData.totalItems > 0) {
        debugInfo.isbnMatch = true;
        // ISBN is authoritative; mark verified
        status = 'verified';
      }
    }

    if (status !== 'verified') {
      debugInfo.usedFallback = true;
      const authorPart = inputAuthorsRaw[0] ? `+inauthor:${inputAuthorsRaw[0]}` : '';
      const q = `intitle:${book.title || ''}${authorPart}`;
      let fbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY}`);
      let fbData = await fbRes.json();
      debugInfo.gbFallbackItems = fbData?.totalItems || 0;
      if (!fbData?.totalItems) {
        debugInfo.fallbackTriedWithoutKey = true;
        fbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
        fbData = await fbRes.json();
        debugInfo.gbFallbackItems = fbData?.totalItems || 0;
      }

      if (fbData.totalItems > 0) {
        const fbBook = fbData.items[0].volumeInfo || {};
        const apiAuthors = (fbBook.authors || []).map((a: string) => normalize(a));
        const normalizedApiTitle = normalize(fbBook.title || '');
        const normalizedApiTitleNoSub = normalize(stripSubtitlesRaw(fbBook.title || ''));
        const allAuthorsPresent = inputAuthors.length > 0 && inputAuthors.every((a: string) => apiAuthors.includes(a));
        const anyAuthorMatch = inputAuthors.length > 0 && inputAuthors.some((a: string) => apiAuthors.includes(a));
        const titleExactMatch = normalizedApiTitle === normalizedInputTitle || normalizedApiTitleNoSub === normalizedInputTitleNoSub;
        const titleLooseMatch =
          normalizedApiTitle.includes(normalizedInputTitle) ||
          normalizedInputTitle.includes(normalizedApiTitle) ||
          normalizedApiTitleNoSub.includes(normalizedInputTitleNoSub) ||
          normalizedInputTitleNoSub.includes(normalizedApiTitleNoSub);
        Object.assign(debugInfo, {
          normalizedApiTitle,
          normalizedApiTitleNoSub,
          normalizedApiAuthors: apiAuthors,
          titleExactMatch,
          titleLooseMatch,
          allAuthorsPresent,
          anyAuthorMatch,
        });

        if ((titleExactMatch || titleLooseMatch) && (allAuthorsPresent || anyAuthorMatch)) {
          status = 'verified';
        } else {
          status = 'admin_review';
        }
      } else {
        status = 'admin_review';
      }
    }
  } catch (e: any) {
    status = 'admin_review';
    debugInfo.error = e?.message || String(e);
  }
  // Compute consolidated ISBN fields
  const consolidated = {
    isbn_primary: (book.isbn_primary || '').replace(/[^0-9Xx]/g, '').toUpperCase(),
    isbn_secondary: (book.isbn_secondary || '').replace(/[^0-9Xx]/g, '').toUpperCase(),
  };

  // Insert book with status and isbn fields
  const { error } = await supabaseAdmin.from('books').insert([{ ...book, ...consolidated, status }]);
  if (error) {
    // Common root cause: RLS policies active and wrong key used. Provide an actionable hint.
    const hint = error.message && /row-level security/.test(error.message.toLowerCase())
      ? 'Row-level security blocked the insert. Ensure SUPABASE_SERVICE_ROLE_KEY is set for server-side calls or update RLS policies.'
      : undefined;
    return new Response(JSON.stringify({ error: error.message, hint }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, status, debugInfo }), { status: 200 });
}
