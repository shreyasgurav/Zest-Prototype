import React from "react";
import styles from "./GuidesBox.module.css";
import { useRouter } from "next/router";
import { getAuth } from 'firebase/auth';
import { db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { FaTrash, FaEdit } from 'react-icons/fa';
import { generateSlug } from "@/utils/generateSlug";
import Image from 'next/image';

interface Guide {
  id: string;
  name: string;
  cover_image?: string;
  slug?: string;
  createdBy?: string;
}

interface GuidesBoxProps {
  guide: Guide;
  onDelete: (id: string) => void;
}

function GuidesBox({ guide, onDelete }: GuidesBoxProps) {
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isGuideCreator = currentUser && currentUser.uid === guide?.createdBy;

  const handleClick = async () => {
    try {
      if (!guide.slug && guide.name) {
        const newSlug = generateSlug(guide.name);
        const guideRef = doc(db, "guides", guide.id);
        await updateDoc(guideRef, {
          slug: newSlug
        });
        router.push(`/guides/${newSlug}`);
      } else if (guide.slug) {
        router.push(`/guides/${guide.slug}`);
      } else {
        router.push(`/guides/${generateSlug(guide.name)}`);
      }
    } catch (error) {
      console.error("Error handling guide click:", error);
      router.push(`/guidepage/${guide.id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isGuideCreator) return;

    try {
      if (window.confirm("Are you sure you want to delete this guide?")) {
        await deleteDoc(doc(db, "guides", guide.id));
        if (onDelete) {
          onDelete(guide.id);
        }
      }
    } catch (error) {
      console.error("Error deleting guide:", error);
      alert("Failed to delete guide. Please try again.");
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isGuideCreator) return;
    router.push(`/edit-guide/${guide.id}`);
  };

  return (
    <div className={styles['guides-box-wrapper']} onClick={handleClick}>
      <div className={styles['guides-box-card']}>
        {isGuideCreator && (
          <>
            <div className={styles['guides-box-delete-btn']} onClick={handleDelete}>
              <FaTrash />
            </div>
            <div className={styles['guides-box-edit-btn']} onClick={handleEdit}>
              <FaEdit />
            </div>
          </>
        )}
        {guide.cover_image ? (
          <div className={styles['guides-box-image-container']}>
            <Image 
              src={guide.cover_image} 
              alt={guide.name}
              className={styles['guides-box-image']}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className={styles['guides-box-image-placeholder']}>
            No Image Available
          </div>
        )}

        <div className={styles['guides-box-info']}>
          <h3>{guide.name}</h3>
        </div>
      </div>
    </div>
  );
}

export default GuidesBox; 