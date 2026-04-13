import type { RequestHandler } from './$types';
import axios from 'axios';

export const GET: RequestHandler = async ({ url }) => {
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
        return new Response('Missing URL', { status: 400 });
    }

    try {
        const decodedUrl = decodeURIComponent(targetUrl);
        
        if (!decodedUrl.startsWith('http')) {
            return new Response('Invalid URL', { status: 400 });
        }

        const referer = decodedUrl.includes('bazos.cz') ? 'https://www.bazos.cz' : 
                         (decodedUrl.includes('sbazar.cz') || decodedUrl.includes('sdn.cz')) ? 'https://www.sbazar.cz/' :
                         (decodedUrl.includes('aukro')) ? 'https://aukro.cz' :
                         (decodedUrl.includes('cyklobazar')) ? 'https://www.cyklobazar.cz' : '';

        const response = await axios.get(decodedUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
                'Referer': referer,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
            },
            timeout: 15000,
            validateStatus: () => true, // capture all responses
        });

        if (response.status >= 400) {
            console.error(`[Image Proxy] Upstream status ${response.status} for URL: ${decodedUrl}`);
            console.error(`[Image Proxy] Upstream headers:`, JSON.stringify(response.headers));
            // Return 502 for upstream failures to follow standard proxy behavior
            return new Response(`Upstream error ${response.status}`, { status: 502 });
        }

        const contentType = response.headers['content-type'] || 'image/jpeg';
        console.log(`[Image Proxy] Success: ${decodedUrl} (${contentType}, ${response.data.length} bytes)`);

        return new Response(response.data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400', 
                'Access-Control-Allow-Origin': '*',
                'X-Proxy-By': 'DealHunter'
            },
        });
    } catch (e: any) {
        console.error(`[Image Proxy Fatal Error] ${targetUrl}:`, e.message);
        return new Response('Failed to fetch image', { status: 502 });
    }
};
