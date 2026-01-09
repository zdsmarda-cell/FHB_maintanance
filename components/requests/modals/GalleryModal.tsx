
import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryModalProps {
    images: string[];
    currentIndex: number;
    onClose: () => void;
    onNext: (e: React.MouseEvent) => void;
    onPrev: (e: React.MouseEvent) => void;
}

export const GalleryModal = ({ images, currentIndex, onClose, onNext, onPrev }: GalleryModalProps) => {
    return (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
                <X className="w-8 h-8" />
            </button>
            
            {images.length > 1 && currentIndex > 0 && (
                <button onClick={onPrev} className="absolute left-4 text-white p-2 hover:bg-white/10 rounded-full">
                    <ChevronLeft className="w-8 h-8" />
                </button>
            )}
            
            <img 
                src={images[currentIndex]} 
                alt="Gallery" 
                className="max-w-full max-h-full object-contain" 
                onClick={e => e.stopPropagation()} 
            />
            
            {images.length > 1 && currentIndex < images.length - 1 && (
                <button onClick={onNext} className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-full">
                    <ChevronRight className="w-8 h-8" />
                </button>
            )}
            
            <div className="absolute bottom-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                {currentIndex + 1} / {images.length}
            </div>
        </div>
    );
};
