export const downloadPDF = (data: Uint8Array | ArrayBuffer | null, fileName = "invoice.pdf") => {
    if (!data)
        return;
    const pdfBuffer = data instanceof ArrayBuffer
        ? data
        : (() => {
            // Ensure we pass a guaranteed ArrayBuffer (not SharedArrayBuffer)
            const bytes = new Uint8Array(new ArrayBuffer(data.byteLength));
            bytes.set(data);
            return bytes.buffer;
        })();
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
