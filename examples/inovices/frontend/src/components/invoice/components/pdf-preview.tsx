import { memo, useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerSrc from "pdfjs-dist/build/pdf.worker?url";
import { Button } from "@heroui/button";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, } from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;
const DEBOUNCE_TIMEOUT = 200; // ms to wait before rendering
const PDFPreview = ({ data }: {
    data: Uint8Array | null;
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timeoutRef = useRef<number | undefined>(undefined);
    const pdfRef = useRef<PDFDocumentProxy | null>(null);
    const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
    const renderTaskRef = useRef<RenderTask | null>(null);
    const renderGenerationRef = useRef(0);
    const destroyChainRef = useRef<Promise<void>>(Promise.resolve());
    const loadSeqRef = useRef(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [pdfKey, setPdfKey] = useState(0);
    useEffect(() => {
        const mySeq = (loadSeqRef.current += 1);
        let cancelled = false;
        const run = async () => {
            // Ensure previous destroy() fully finishes before starting a new load.
            await destroyChainRef.current;
            if (cancelled || mySeq !== loadSeqRef.current)
                return;
            if (!data) {
                pdfRef.current = null;
                loadingTaskRef.current = null;
                renderTaskRef.current?.cancel();
                renderTaskRef.current = null;
                setPageNumber(1);
                setPageCount(0);
                setPdfKey((k) => k + 1);
                return;
            }
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
            loadingTaskRef.current = loadingTask;
            try {
                const pdf = await loadingTask.promise;
                if (cancelled || mySeq !== loadSeqRef.current) {
                    await loadingTask.destroy();
                    return;
                }
                pdfRef.current = pdf;
                setPageCount(pdf.numPages);
                setPageNumber((p) => Math.min(Math.max(1, p), pdf.numPages));
                setPdfKey((k) => k + 1);
            }
            catch (err) {
                if (cancelled)
                    return;
                console.error("PDF load error:", err);
                pdfRef.current = null;
                setPageCount(0);
                setPdfKey((k) => k + 1);
            }
        };
        void run();
        return () => {
            cancelled = true;
            renderTaskRef.current?.cancel();
            renderTaskRef.current = null;
            pdfRef.current = null;
            const taskToDestroy = loadingTaskRef.current;
            if (taskToDestroy) {
                if (loadingTaskRef.current === taskToDestroy) {
                    loadingTaskRef.current = null;
                }
                destroyChainRef.current = destroyChainRef.current
                    .then(async () => {
                    try {
                        await taskToDestroy.destroy();
                    }
                    catch (err) {
                        console.warn("PDF destroy error:", err);
                    }
                })
                    .catch(() => undefined);
            }
        };
    }, [data]);
    const goPrev = useCallback(() => {
        setPageNumber((p) => Math.max(1, p - 1));
    }, []);
    const goNext = useCallback(() => {
        setPageNumber((p) => (pageCount ? Math.min(pageCount, p + 1) : p + 1));
    }, [pageCount]);
    useEffect(() => {
        if (!data || !canvasRef.current)
            return;
        const pdf = pdfRef.current;
        if (!pdf)
            return;
        timeoutRef.current = window.setTimeout(() => {
            const renderPdf = async () => {
                try {
                    renderGenerationRef.current += 1;
                    const generation = renderGenerationRef.current;
                    renderTaskRef.current?.cancel();
                    renderTaskRef.current = null;
                    const page = await pdf.getPage(pageNumber);
                    if (generation !== renderGenerationRef.current)
                        return;
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = canvasRef.current;
                    const context = canvas?.getContext("2d");
                    if (!canvas || !context)
                        return;
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const task = page.render({ canvasContext: context, viewport, canvas });
                    renderTaskRef.current = task;
                    await task.promise;
                }
                catch (err) {
                    // pdf.js throws on cancellation; avoid noisy console errors.
                    if (String(err).includes("Rendering cancelled"))
                        return;
                    console.error("PDF rendering error:", err);
                }
            };
            renderPdf();
        }, DEBOUNCE_TIMEOUT);
        return () => {
            clearTimeout(timeoutRef.current);
            renderGenerationRef.current += 1;
            renderTaskRef.current?.cancel();
            renderTaskRef.current = null;
        };
    }, [data, pageNumber, pdfKey]);
    return (<div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="flat" isDisabled={pageNumber <= 1 || pageCount === 0} onPress={goPrev}>
            Previous
          </Button>
          <Button size="sm" variant="flat" isDisabled={pageCount !== 0 && pageNumber >= pageCount} onPress={goNext}>
            Next
          </Button>
        </div>
        <div className="text-xs font-semibold text-foreground-500">
          Page {pageCount ? pageNumber : "—"} / {pageCount || "—"}
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full rounded-xl shadow-md border"/>
    </div>);
};
export default memo(PDFPreview);
