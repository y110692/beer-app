
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove "data:*/*;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });
};

// Function to add a watermark to an image
const addWatermark = (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = imageUrl;

        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas 2D context.'));
            }

            canvas.width = image.width;
            canvas.height = image.height;

            // Draw the original image
            ctx.drawImage(image, 0, 0);

            // Set watermark style
            const fontSize = Math.max(12, Math.min(image.width / 45, image.height / 35));
            ctx.font = `bold ${fontSize.toFixed(0)}px Arial, sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.77)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';

            // Add a subtle shadow for better legibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            // Draw the watermark text
            const padding = 10;
            ctx.fillText('@y8n', canvas.width - padding, canvas.height - padding);

            resolve(canvas.toDataURL('image/png'));
        };

        image.onerror = (error) => {
            reject(new Error(`Failed to load image for watermarking: ${error}`));
        };
    });
};


// SVG Icons defined outside the main component
const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919 1.266.058 1.644.07 4.85.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98.059-1.281.073-1.689.073-4.948s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98-1.281-.058-1.689-.072-4.948-.072z" />
        <path d="M12 6.865c-2.838 0-5.135 2.297-5.135 5.135s2.297 5.135 5.135 5.135 5.135-2.297 5.135-5.135-2.297-5.135-5.135-5.135zm0 8.27c-1.73 0-3.135-1.405-3.135-3.135s1.405-3.135 3.135-3.135 3.135 1.405 3.135 3.135-1.405 3.135-3.135-3.135z" />
        <path d="M16.949 6.845c-.768 0-1.39.622-1.39 1.39s.622 1.39 1.39 1.39 1.39-.622 1.39-1.39-.622-1.39-1.39-1.39z" />
    </svg>
);

const TelegramIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M11.944 0C5.356 0 0 5.356 0 11.944s5.356 11.944 11.944 11.944 11.944-5.356 11.944-11.944S18.532 0 11.944 0zM17.436 7.913l-2.457 11.45c-.17.789-.635.989-1.286.618l-3.729-2.738-1.796 1.724c-.2.2-.367.367-.735.367l.267-3.793 6.892-6.223c.307-.276-.076-.433-.49-.157l-8.527 5.37-3.659-1.14c-.78-.245-.794-.84.153-1.254l14.2-5.524c.646-.25 1.18.156.974.96z" />
    </svg>
);

const loadingPhrases = [
    "ИИ наливает холодненькое — подожди секунду!",
    "Ща-ща, доведём пенку до идеала!",
    "Заливаем настроение по максимуму…",
    "Хоп! Почти готово, ещё капелька пикселей!",
    "Нейросеть в роли бармена — мешает, пенит, творит!",
];

const App: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>(loadingPhrases[0]);
    const [makeHappy, setMakeHappy] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isLoading) return;

        let phraseIndex = 0;
        const interval = setInterval(() => {
            phraseIndex = (phraseIndex + 1) % loadingPhrases.length;
            setLoadingMessage(loadingPhrases[phraseIndex]);
        }, 2500);
        
        setLoadingMessage(loadingPhrases[0]);

        return () => clearInterval(interval);
    }, [isLoading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setGeneratedImageUrl(null);
            setError(null);
            setImageFile(file);
            setOriginalImageUrl(URL.createObjectURL(file));
        }
    };

    const handleReset = () => {
        setImageFile(null);
        setOriginalImageUrl(null);
        setGeneratedImageUrl(null);
        setError(null);
        setMakeHappy(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const addBeerToImage = useCallback(async (base64Image: string, mimeType: string, shouldMakeHappy: boolean) => {
      if (!process.env.API_KEY) {
          throw new Error("API_KEY is not configured.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      let promptText = 'Добавь в руку человека фотореалистичную прозрачную стеклянную пивную кружку, слегка запотевшую от холода, наполненную золотистым пивом с густой белой пенкой, которая красиво переливается и немного стекает по бокам. Сделай это максимально реалистично и естественно. Изображение должно остаться того же размера.';
      if (shouldMakeHappy) {
          promptText = 'Добавь в руку человека фотореалистичную прозрачную стеклянную пивную кружку, слегка запотевшую от холода, наполненную золотистым пивом с густой белой пенкой, которая красиво переливается и немного стекает по бокам. Также добавь на выражение лица человека легкую и добрую улыбку, можно без показа зубов. Сделай все максимально реалистично и естественно. Изображение должно остаться того же размера.';
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart && firstPart.inlineData) {
        return firstPart.inlineData.data;
      } else {
        throw new Error("Не удалось получить изображение от AI. Попробуйте еще раз.");
      }
    }, []);

    const handleAddBeer = async () => {
        if (!imageFile) return;

        setIsLoading(true);
        setError(null);
        setGeneratedImageUrl(null);

        try {
            const base64Image = await fileToBase64(imageFile);
            const generatedBase64 = await addBeerToImage(base64Image, imageFile.type, makeHappy);
            const watermarkedImageUrl = await addWatermark(`data:image/png;base64,${generatedBase64}`);
            setGeneratedImageUrl(watermarkedImageUrl);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Что-то пошло не так. Попробуйте другое фото.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 tracking-tight">
                        ИИ Добавлятель Пива 🍺
                    </h1>
                    <p className="text-gray-400 mt-2">Загрузи фото, и магия AI добавит пенного!</p>
                </header>

                <main className="w-full bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col items-center gap-6">
                    {!originalImageUrl && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-64 border-4 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400 hover:bg-gray-700 transition-all duration-300"
                        >
                            <UploadIcon className="w-16 h-16 text-gray-500" />
                            <p className="mt-4 text-lg font-semibold">Перетащите файл сюда</p>
                            <p className="text-gray-400">или нажмите для выбора</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/png, image/jpeg, image/webp"
                                className="hidden"
                            />
                        </div>
                    )}

                    {originalImageUrl && (
                        <div className="w-full flex flex-col items-center">
                           <div className="relative w-full max-w-md rounded-lg overflow-hidden border-2 border-gray-700">
                             <img src={originalImageUrl} alt="Original" className="w-full h-auto object-contain" />
                           </div>
                        </div>
                    )}
                    
                    {originalImageUrl && (
                        <div className="flex items-center justify-center my-2">
                            <label htmlFor="happy-checkbox" className="flex items-center cursor-pointer select-none p-2 rounded-lg hover:bg-gray-700 transition-colors">
                                <input
                                    id="happy-checkbox"
                                    type="checkbox"
                                    checked={makeHappy}
                                    onChange={() => setMakeHappy(!makeHappy)}
                                    className="w-5 h-5 bg-gray-600 border-gray-500 rounded text-yellow-400 focus:ring-yellow-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
                                />
                                <span className="ml-3 text-gray-300 font-medium">
                                    Добавить легкую улыбку ☺️
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="w-full flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleAddBeer}
                            disabled={!imageFile || isLoading}
                            className="w-full sm:w-auto px-8 py-3 bg-yellow-400 text-gray-900 font-bold rounded-lg shadow-lg hover:bg-yellow-300 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400 transition-all duration-300 transform hover:scale-105"
                        >
                            {isLoading ? 'Добавляем пиво...' : 'Добавить пиво'}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-8 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors duration-300"
                        >
                            Сбросить
                        </button>
                    </div>

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-400"></div>
                            <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
                             <p className="text-gray-400">Это может занять до минуты.</p>
                        </div>
                    )}

                    {error && (
                        <div className="w-full bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center">
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {generatedImageUrl && (
                        <div className="w-full mt-6 flex flex-col items-center">
                            <h2 className="text-2xl font-bold text-yellow-400 mb-4">
                                Готово! Ваше фото с пивом (<a href={generatedImageUrl} download="beer-photo.png" className="underline hover:text-yellow-300 transition-colors">скачать</a>):
                            </h2>
                            <a href={generatedImageUrl} download="beer-photo.png" title="Нажмите, чтобы скачать" className="block relative w-full max-w-md rounded-lg overflow-hidden border-2 border-yellow-400 shadow-lg shadow-yellow-500/10">
                                <img src={generatedImageUrl} alt="Generated with beer" className="w-full h-auto object-contain" />
                            </a>
                        </div>
                    )}
                </main>

                <footer className="mt-12 text-center text-gray-500">
                    <p>Подписывайся:</p>
                    <div className="flex justify-center items-center gap-6 mt-4">
                        <a href="https://www.instagram.com/y8n" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-yellow-400 transition-colors">
                            <InstagramIcon className="w-6 h-6" />
                            <span>@y8n</span>
                        </a>
                        <a href="https://t.me/y8ntv" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-yellow-400 transition-colors">
                            <TelegramIcon className="w-6 h-6" />
                            <span>@y8ntv</span>
                        </a>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default App;
