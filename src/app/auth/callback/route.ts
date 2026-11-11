import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirectTo');

  if (code) {
    let response = NextResponse.redirect(new URL('/', request.url));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.redirect(new URL('/', request.url));
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Determine user role for intelligent landing redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const userRole = profile?.role;

      let destination = '/account';

      if (userRole === 'manager') {
        destination = '/inventory';
      } else if (userRole === 'cashier') {
        destination = '/pos';
      } else if (next && next.startsWith('/') && !next.startsWith('//')) {
        destination = next;
      }

      const redirectUrl = new URL(destination, request.url);
      response = NextResponse.redirect(redirectUrl);

      // Re-apply cookies to the final redirect response
      const allCookies = request.cookies.getAll();
      allCookies.forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value);
      });

      return response;
    }
  }

  // Fallback if code missing or error occurred
  const errorUrl = new URL('/login?error=oauth_failed', request.url);
  return NextResponse.redirect(errorUrl);
}

