import React from 'react';
import { CreativeStudioModule } from './CreativeStudioModule';

/**
 * Studio de Présentation SHALOM
 * Espace dédié aux diapositives 16:9 multi-pages, transitions, diaporama interactif,
 * modèles de prédication / formation / annonces et export PDF / PNG / JPG.
 */
export const PresentationStudioModule: React.FC = () => {
  return <CreativeStudioModule mode="presentation" />;
};

export default PresentationStudioModule;
