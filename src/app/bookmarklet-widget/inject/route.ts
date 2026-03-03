import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the host from the request to use as the widget origin
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const widgetOrigin = `${protocol}://${host}`;
  
  const script = `
(function() {
  // Prevent multiple instances
  if (window.CAPTURE_HUB_WIDGET) {
    window.CAPTURE_HUB_WIDGET.style.display = 'block';
    return;
  }

  // The Capture Hub server origin (where this script was loaded from)
  var widgetOrigin = '${widgetOrigin}';
  var widgetUrl = widgetOrigin + '/bookmarklet-widget';

  // Get page information
  function getPageInfo() {
    var selectedText = '';
    var selection = window.getSelection();
    if (selection && selection.toString()) {
      selectedText = selection.toString().trim();
    }

    // Get meta description
    var description = '';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      description = metaDesc.getAttribute('content') || '';
    }

    // Get favicon
    var favicon = '';
    var faviconLink = document.querySelector('link[rel="icon"]') ||
                      document.querySelector('link[rel="shortcut icon"]');
    if (faviconLink) {
      favicon = faviconLink.getAttribute('href') || '';
      if (favicon && !favicon.startsWith('http')) {
        favicon = window.location.origin + (favicon.startsWith('/') ? '' : '/') + favicon;
      }
    }

    return {
      url: window.location.href,
      title: document.title,
      description: description,
      selectedText: selectedText,
      favicon: favicon
    };
  }

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'capture-hub-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2147483646;backdrop-filter:blur(4px);';

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'capture-hub-widget';
  iframe.src = widgetUrl;
  iframe.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:420px;max-width:95vw;max-height:90vh;border-radius:16px;border:none;z-index:2147483647;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);overflow:hidden;';
  iframe.allow = 'clipboard-write; display-capture';

  // Add to page
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  window.CAPTURE_HUB_WIDGET = iframe;
  window.CAPTURE_HUB_OVERLAY = overlay;

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeWidget();
    }
  });

  // Listen for messages from iframe
  window.addEventListener('message', function(event) {
    // Accept messages from our widget origin
    if (event.origin !== widgetOrigin) return;

    // Widget requests page info
    if (event.data && event.data.type === 'CAPTURE_HUB_REQUEST_INFO') {
      var info = getPageInfo();
      iframe.contentWindow.postMessage({
        type: 'CAPTURE_HUB_PAGE_INFO',
        ...info
      }, widgetOrigin);
    }

    // Widget requests close
    if (event.data && event.data.type === 'CAPTURE_HUB_CLOSE') {
      closeWidget();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeWidget();
      document.removeEventListener('keydown', escHandler);
    }
  });

  function closeWidget() {
    if (window.CAPTURE_HUB_WIDGET) {
      window.CAPTURE_HUB_WIDGET.remove();
      window.CAPTURE_HUB_WIDGET = null;
    }
    if (window.CAPTURE_HUB_OVERLAY) {
      window.CAPTURE_HUB_OVERLAY.remove();
      window.CAPTURE_HUB_OVERLAY = null;
    }
  }

  console.log('Capture Hub widget loaded');
})();
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
