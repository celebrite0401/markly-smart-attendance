import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SecureImageProps {
  filePath: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

export const SecureImage: React.FC<SecureImageProps> = ({ filePath, alt, className, onError }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchSecureUrl = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const { data, error: fetchError } = await supabase.functions.invoke('secure-image-access', {
          body: { filePath }
        });

        if (fetchError) {
          console.error('Error getting secure image URL:', fetchError);
          setError(true);
          onError?.();
          return;
        }

        if (data?.signedUrl) {
          setImageUrl(data.signedUrl);
        } else {
          setError(true);
          onError?.();
        }
      } catch (err) {
        console.error('Error fetching secure image URL:', err);
        setError(true);
        onError?.();
      } finally {
        setLoading(false);
      }
    };

    if (filePath) {
      fetchSecureUrl();
    }
  }, [filePath, onError]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-muted rounded ${className}`}>
        <div className="w-full h-full bg-muted-foreground/20 rounded"></div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`bg-muted rounded flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
        onError?.();
      }}
    />
  );
};