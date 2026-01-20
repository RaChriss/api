import { ref, watch, onMounted } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { isPlatform } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';

export const usePhotoGallery = () => {
    const photos = ref<UserPhoto[]>([]);
    const PHOTO_STORAGE = 'photos';

    const addNewToGallery = async () => {

        const capturedPhoto = await Camera.getPhoto({

            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100,
        });

        const fileName = Date.now() + '.jpeg';

        const savedImageFile = await savePicture(capturedPhoto, fileName);
        
        photos.value = [savedImageFile, ...photos.value];
    };

    const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
        let base64Data: string | Blob;

        if (isPlatform('hybrid')) {
        const readFile = await Filesystem.readFile({
        path: photo.path!,
    });
        base64Data = readFile.data;
    } else {

        const response = await fetch(photo.webPath!);
        const blob = await response.blob();
        base64Data = (await convertBlobToBase64(blob)) as string;
    }

        const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Data,
    });

    

    const cachePhotos = () => {

        Preferences.set({
            key: 'PHOTO_STORAGE',
            value: JSON.stringify(photos.value),
        });
    };

    const loadSaved = async () => {
        const photoList = await Preferences.get({ key: PHOTO_STORAGE });
        const photosInPreferences = photoList.value ? JSON.parse(photoList.value) : [];

        for(const photo of photosInPreferences){
            const readFile = await Filesystem.readFile({
                path: photo.filepath,
                directory: Directory.Data,
            });
            photo.webviewPath = 'data:image/jpeg;base64,${readFile.data}';
        }

        photos.value = photosInPreferences;

    };

    onMounted(loadSaved);
    watch(photos, cachePhotos);

    return{
            filepath: fileName,
            webviewPath: photo.webPath,
        };
    };

    const convertBlobToBase64 = (blob : Blob) => {
        return  new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.readAsDataURL(blob);
        });
    };

    return{
        addNewToGallery,
        photos
    };
};

export interface UserPhoto {
    filepath : string;
    webviewPath?: string;
}

