import React, { useEffect } from 'react';
import { LocalizedText } from '../hooks/useLanguage';
import cvEs from '../assets/curriculum/cv-es.pdf';
import cvEn from '../assets/curriculum/cv-en.pdf';

interface CVModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CVModal: React.FC<CVModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown as EventListener);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown as EventListener);
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`modal ${isOpen ? 'active' : ''}`} id="cvModal">
      <div className="modal-overlay" id="cvModalOverlay" onClick={onClose}></div>
      <div className="modal-content cv-modal-content">
        <button className="modal-close" id="cvModalClose" onClick={onClose}>&times;</button>
        <h3>
          <LocalizedText 
            en="Select CV Language" 
            es="Selecciona el idioma del CV" 
            fr="Sélectionner la langue du CV" 
            de="CV-Sprache wählen" 
            pt="Selecione o idioma do CV" 
          />
        </h3>
        <div className="cv-options">
          <a href={cvEs} target="_blank" rel="noopener noreferrer" className="btn btn-primary cv-option-btn" onClick={onClose}>
            <LocalizedText en="Spanish CV" es="CV en Español" fr="CV en Espagnol" de="CV auf Spanisch" pt="CV em Espanhol" />
          </a>
          <a href={cvEn} target="_blank" rel="noopener noreferrer" className="btn btn-outline cv-option-btn" onClick={onClose}>
            <LocalizedText en="English CV" es="CV en Inglés" fr="CV en Anglais" de="CV auf Englisch" pt="CV em Inglês" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default CVModal;
