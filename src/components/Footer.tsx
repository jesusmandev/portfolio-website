import React from 'react';
import { LocalizedText } from '../hooks/useLanguage';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <p>
        <LocalizedText 
          en="© 2026 Jesus Martinez • All rights reserved" 
          es="© 2026 Jesus Martinez • Todos los derechos reservados" 
          fr="© 2026 Jesus Martinez • Tous droits réservés" 
          de="© 2026 Jesus Martinez • Alle Rechte vorbehalten" 
          pt="© 2026 Jesus Martinez • Todos os direitos reservados" 
        />
      </p>
    </footer>
  );
};

export default Footer;
