import React, { useEffect } from 'react';

interface CertModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
}

const CertModal: React.FC<CertModalProps> = ({ isOpen, onClose, imageSrc }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`modal ${isOpen ? 'active' : ''}`} id="certModal">
      <div className="modal-overlay" id="modalOverlay" onClick={onClose}></div>
      <div className="modal-content">
        <button className="modal-close" id="modalClose" onClick={onClose}>&times;</button>
        <img src={imageSrc || undefined} alt="Certificado" id="modalImage" />
      </div>
    </div>
  );
};

export default CertModal;
