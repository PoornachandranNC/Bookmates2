import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalize(str: string) {
  return (str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function stripSubtitlesRaw(str: string) {
  return (str || '').split(/[:\-–—]/)[0];
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing book id' }), { status: 400 });
  // Get book from DB
  const { data: books, error: fetchError } = await supabase.from('books').select('*').eq('id', id);
  if (fetchError || !books || books.length === 0) {
    return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
  }
  const book = books[0];

  const inputAuthorsRaw: string[] = (book.author || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const inputAuthors = inputAuthorsRaw.map((a: string) => normalize(a));
  const normalizedInputTitle = normalize(book.title || '');
  const normalizedInputTitleNoSub = normalize(stripSubtitlesRaw(book.title || ''));

  let status: 'pending' | 'verified' | 'admin_review' = 'pending';
  let debugInfo: any = {
    isbnProvided: Boolean(book.isbn),
    isbnMatch: false,
    gbIsbnItems: 0,
  isbnOriginal: book.isbn || '',
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
    if (book.isbn) {
      const rawIsbn = String(book.isbn || '');
      const sanitizedIsbn = rawIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();
      debugInfo.isbnSanitized = sanitizedIsbn;

      // Attempt with key first
      let gbRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(sanitizedIsbn)}&maxResults=1&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY}`
      );
      let gbData = await gbRes.json();
      debugInfo.gbIsbnItems = gbData?.totalItems || 0;

      // If nothing returned, try again without key (helps if key is missing/invalid or quota issues)
      if (!gbData?.totalItems) {
        debugInfo.isbnTriedWithoutKey = true;
        gbRes = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(sanitizedIsbn)}&maxResults=1`
        );
        gbData = await gbRes.json();
        debugInfo.gbIsbnItems = gbData?.totalItems || 0;
      }

      if (gbData.totalItems > 0) {
        debugInfo.isbnMatch = true;
        const gbBook = gbData.items[0].volumeInfo || {};
        const apiAuthors = (gbBook.authors || []).map((a: string) => normalize(a));
        const normalizedApiTitle = normalize(gbBook.title || '');
        const normalizedApiTitleNoSub = normalize(stripSubtitlesRaw(gbBook.title || ''));
        const allAuthorsPresent = inputAuthors.length > 0 && inputAuthors.every((a: string) => apiAuthors.includes(a));
        const anyAuthorMatch = inputAuthors.length > 0 && inputAuthors.some((a: string) => apiAuthors.includes(a));
        const titleExactMatch =
          normalizedApiTitle === normalizedInputTitle ||
          normalizedApiTitleNoSub === normalizedInputTitleNoSub;
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

        // If ISBN matched, consider it verified directly (most reliable)
        status = 'verified';
      }
    }

    // Fallback: title + author search if not already verified
    if (status !== 'verified') {
      debugInfo.usedFallback = true;
      const authorPart = inputAuthorsRaw[0] ? `+inauthor:${inputAuthorsRaw[0]}` : '';
      const q = `intitle:${book.title || ''}${authorPart}`;
      // With key first
      let fbRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY}`
      );
      let fbData = await fbRes.json();
      debugInfo.gbFallbackItems = fbData?.totalItems || 0;

      // Retry without key if zero items
      if (!fbData?.totalItems) {
        debugInfo.fallbackTriedWithoutKey = true;
        fbRes = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`
        );
        fbData = await fbRes.json();
        debugInfo.gbFallbackItems = fbData?.totalItems || 0;
      }

      if (fbData.totalItems > 0) {
        // Check top result for a match
        const fbBook = fbData.items[0].volumeInfo || {};
        const apiAuthors = (fbBook.authors || []).map((a: string) => normalize(a));
        const normalizedApiTitle = normalize(fbBook.title || '');
        const normalizedApiTitleNoSub = normalize(stripSubtitlesRaw(fbBook.title || ''));
        const allAuthorsPresent = inputAuthors.length > 0 && inputAuthors.every((a: string) => apiAuthors.includes(a));
        const anyAuthorMatch = inputAuthors.length > 0 && inputAuthors.some((a: string) => apiAuthors.includes(a));
        const titleExactMatch =
          normalizedApiTitle === normalizedInputTitle ||
          normalizedApiTitleNoSub === normalizedInputTitleNoSub;
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

  // Update book status
  const { error: updateError } = await supabase.from('books').update({ status }).eq('id', id);
  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true, status, debugInfo }), { status: 200 });
}
