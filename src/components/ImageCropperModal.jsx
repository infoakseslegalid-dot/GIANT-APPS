import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export function ImageCropperModal({ isOpen, onClose, imageSrc, onCropComplete }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (croppedAreaPixels) {
      onCropComplete(croppedAreaPixels);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--elevated))]" data-testid="image-cropper-modal">
        <DialogHeader>
          <DialogTitle>Sesuaikan Foto</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[300px] bg-black/10 rounded-md overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
        <div className="flex items-center gap-4 py-2">
          <span className="text-sm font-medium">Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[#0c66e4]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button 
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-[hsl(var(--muted))] text-foreground text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Batal
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="h-9 px-4 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95"
          >
            Simpan
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
