import { renderToReadableStream } from "react-dom/server";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { initI18n } from "./i18n";
import config from "./utils/config";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  const lang = process.env.APP_LANG || config.lang;
  initI18n(lang);

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("Content-Language", lang);
  const comment = `<!--Tf ben je hier aan het doen. Opensource: github/supersiem/librelearn-->\n`;
  const commentStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(comment));
      controller.close();
    },
  });

  const combinedBody = new ReadableStream({
    async start(controller) {
      const reader1 = commentStream.getReader();
      const reader2 = body.getReader();

      while (true) {
        const { done, value } = await reader1.read();
        if (done) break;
        controller.enqueue(value);
      }

      while (true) {
        const { done, value } = await reader2.read();
        if (done) break;
        controller.enqueue(value);
      }

      controller.close();
    },
  });

  return new Response(combinedBody, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}