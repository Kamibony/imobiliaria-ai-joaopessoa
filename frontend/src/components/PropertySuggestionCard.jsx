import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { getLocalizedText, useLanguage } from '../LanguageContext';
import { useMapState } from '../MapStateContext';
import { FiMap } from 'react-icons/fi';

const PropertySuggestionCard = ({ slug }) => {
  const [project, setProject] = useState(null);
  const [heroImageUrl, setHeroImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { flyToProject } = useMapState();

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const docRef = doc(db, 'projects', slug);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProject(data);

          if (data.manual_hero_image_url) {
            setHeroImageUrl(data.manual_hero_image_url);
          } else if (data.assets?.hero_images && data.assets.hero_images.length > 0) {
            const storage = getStorage();
            const fileRef = ref(storage, data.assets.hero_images[0]);
            const downloadURL = await getDownloadURL(fileRef);
            setHeroImageUrl(downloadURL);
          }
        }
      } catch (e) {
        console.error("Error fetching recommended project:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [slug]);

  if (loading) {
    return <div className="p-4 bg-gray-50 rounded-lg animate-pulse text-sm">Carregando sugestão...</div>;
  }

  if (!project) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col sm:flex-row gap-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow group relative">
      <div
        className="w-full sm:w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 cursor-pointer"
        onClick={() => navigate(`/projetos/${project.id}`)}
      >
        {heroImageUrl ? (
          <img src={heroImageUrl} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Sem Foto</div>
        )}
      </div>
      <div className="flex flex-col justify-center flex-1">
        <h4
          className="font-serif text-lg font-semibold text-gray-900 group-hover:text-[#c5a880] transition-colors cursor-pointer"
          onClick={() => navigate(`/projetos/${project.id}`)}
        >
          {project.name}
        </h4>
        <p className="text-sm text-gray-500">{project.developer || 'Construtora não informada'}</p>
        <div className="mt-2 flex gap-2">
           {project.location?.neighborhood && (
            <span className="text-xs px-2 py-1 bg-black text-white rounded-full">
              {getLocalizedText(project.location.neighborhood, language)}
            </span>
          )}
           {project.ai_context?.investment_roi_estimated_percent && (
            <span className="text-xs px-2 py-1 bg-[#c5a880] text-white rounded-full">
              {project.ai_context.investment_roi_estimated_percent}% ROI
            </span>
          )}
        </div>
      </div>

      {/* Fly-to Map Button */}
      {((project.coordinates?.lat && project.coordinates?.lng) || (project.location?.coordinates?.lat && project.location?.coordinates?.lng)) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            flyToProject(project.coordinates || project.location?.coordinates);
          }}
          className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-[#c5a880] hover:text-white rounded-full transition-colors text-gray-600"
          title="Ver no mapa"
        >
          <FiMap size={16} />
        </button>
      )}
    </div>
  );
};

export default PropertySuggestionCard;
