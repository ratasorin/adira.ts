import { useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export default function PDFPreview({ data }: {
    data: Uint8Array | null;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!data)
            return;
        let disposed = false;
        let render: ReturnType<pdfjs.PDFPageProxy["render"]> | undefined;
        const loading = pdfjs.getDocument({
            data: new Uint8Array(data),
            useSystemFonts: true,
        });
        loading.promise
            .then(async (pdf) => {
            const page = await pdf.getPage(1);
            if (disposed || !canvas.current)
                return;
            const viewport = page.getViewport({ scale: 1.5 });
            const context = canvas.current.getContext("2d");
            if (!context)
                return;
            canvas.current.width = viewport.width;
            canvas.current.height = viewport.height;
            render = page.render({
                canvas: canvas.current,
                canvasContext: context,
                viewport,
            });
            await render.promise;
        })
            .catch((error) => {
            if (!disposed)
                console.error("PDF preview:", error);
        });
        return () => {
            disposed = true;
            render?.cancel();
            void loading.destroy();
        };
    }, [data]);
    return (<canvas ref={canvas} aria-label="Invoice PDF preview" className="w-full rounded-xl shadow-md border"/>);
}
