/// import * as Autodesk from "@types/forge-viewer";

import React, { useEffect, useRef } from 'react';

const { Autodesk } = window;

const runtime = {
    /** @type {Autodesk.Viewing.InitializerOptions} */
    options: null,
    /** @type {Promise<void>} */
    ready: null
};

/**
 * Initializes global runtime for communicating with Autodesk Platform Services.
 * Calling this function repeatedly with different options is not allowed, and will result in an exception.
 * @async
 * @param {Autodesk.Viewing.InitializerOptions} options Runtime initialization options.
 * @returns {Promise<void>}
 */
function initializeViewerRuntime(options) {
    if (!runtime.ready) {
        runtime.options = { ...options };
        runtime.ready = new Promise((resolve) => Autodesk.Viewing.Initializer(runtime.options, resolve));
    } else {
        if (['accessToken', 'getAccessToken', 'env', 'api', 'language'].some(prop => options[prop] !== runtime.options[prop])) {
            return Promise.reject('Cannot initialize another viewer runtime with different settings.')
        }
    }
    return runtime.ready;
}

/**
 * Wrapper for the Autodesk Platform Services viewer component.
 */
const Viewer = React.forwardRef(({ runtime, urn, selectedIds, onCameraChange, onSelectionChange }, ref) => {
    const viewerDiv = useRef(null);
    const viewerInstance = useRef(null);
    const initialized = useRef(false);

    // Initialize viewer
    useEffect(() => {
        if (initialized.current) return;
        
        console.log('Starting viewer initialization');
        const options = {
            env: 'AutodeskProduction',
            api: 'derivativeV2',
            useADP: false,
            useCredentials: true,
            accessToken: runtime.accessToken,
            getAccessToken: (onGetAccessToken) => {
                onGetAccessToken(runtime.accessToken, 3600);
            }
        };

        console.log('Initializing with token:', options.accessToken?.substring(0, 20) + '...');

        if (!window.Autodesk) {
            console.error('Autodesk Viewer library is not loaded');
            return;
        }

        // Set endpoint for the Viewer
        Autodesk.Viewing.endpoint.setEndpointAndApi(
            'https://developer.api.autodesk.com',
            'modelDerivativeV2'
        );

        initializeViewerRuntime(options).then(() => {
            if (!viewerDiv.current || viewerInstance.current) return;

            const viewer = new Autodesk.Viewing.GuiViewer3D(viewerDiv.current);
            viewer.start();
            viewerInstance.current = viewer;
            initialized.current = true;

            if (ref) {
                ref.current = viewer;
            }

            viewer.addEventListener(
                Autodesk.Viewing.CAMERA_CHANGE_EVENT,
                onViewerCameraChange
            );
            viewer.addEventListener(
                Autodesk.Viewing.SELECTION_CHANGED_EVENT,
                onViewerSelectionChange
            );

            console.log('Viewer initialized successfully');
            
            if (urn) {
                loadModel(urn);
            }
        }).catch(error => {
            console.error('Error initializing viewer:', error);
        });

        return () => {
            if (viewerInstance.current) {
                console.log('Cleaning up viewer');
                viewerInstance.current.removeEventListener(
                    Autodesk.Viewing.CAMERA_CHANGE_EVENT,
                    onViewerCameraChange
                );
                viewerInstance.current.removeEventListener(
                    Autodesk.Viewing.SELECTION_CHANGED_EVENT,
                    onViewerSelectionChange
                );
                viewerInstance.current.finish();
                viewerInstance.current = null;
                initialized.current = false;
            }
        };
    }, [urn, runtime.accessToken]);

    // Separate effect for handling runtime changes
    useEffect(() => {
        if (!viewerInstance.current || !initialized.current) return;
        
        // Update viewer with new runtime options if needed
        // This depends on what properties in runtime need to be updated
        // console.log('Runtime updated:', runtime);
    }, [runtime]);

    const loadModel = async (modelUrn) => {
        if (!viewerInstance.current || !modelUrn) {
            console.log('Cannot load model: viewer not ready or no URN provided');
            return;
        }

        console.log('Loading model with URN:', modelUrn);
        
        try {
            const cleanUrn = modelUrn.replace('urn:', '');
            const urnWithPrefix = `urn:${cleanUrn}`;
                
            console.log('Loading document with URN:', urnWithPrefix);
            
            await new Promise((resolve, reject) => {
                const onDocumentLoadSuccess = (doc) => {
                    console.log('Document loaded successfully');
                    const defaultModel = doc.getRoot().getDefaultGeometry();
                    if (!defaultModel) {
                        console.error('No default geometry found in document');
                        reject(new Error('No default geometry'));
                        return;
                    }
                    console.log('Loading default model view');
                    viewerInstance.current.loadDocumentNode(doc, defaultModel);
                    resolve();
                };

                const onDocumentLoadFailure = (code, message, errors) => {
                    console.error('Document loading failed:', { code, message, errors });
                    reject(new Error(message));
                };

                Autodesk.Viewing.Document.load(
                    urnWithPrefix,
                    onDocumentLoadSuccess,
                    onDocumentLoadFailure
                );
            });
        } catch (error) {
            console.error('Error loading model:', error);
        }
    };

    // Handle URN changes
    useEffect(() => {
        console.log('URN effect triggered with:', urn);
        console.log('viewerInstance status:', !!viewerInstance.current);
        
        if (!viewerInstance.current || !initialized.current) {
            console.log('Viewer not yet initialized');
            return;
        }

        if (urn) {
            loadModel(urn);
        } else if (viewerInstance.current.model) {
            console.log('No URN provided, unloading current model');
            viewerInstance.current.unloadModel(viewerInstance.current.model);
        }
    }, [urn, initialized.current]);

    // Handle selection changes
    useEffect(() => {
        if (!viewerInstance.current) return;

        const currentSelection = viewerInstance.current.getSelection();
        if (JSON.stringify(selectedIds || []) !== JSON.stringify(currentSelection)) {
            viewerInstance.current.select(selectedIds);
        }
    }, [selectedIds]);

    const onViewerCameraChange = () => {
        if (onCameraChange && viewerInstance.current) {
            onCameraChange({
                viewer: viewerInstance.current,
                camera: viewerInstance.current.getCamera()
            });
        }
    };

    const onViewerSelectionChange = () => {
        if (onSelectionChange && viewerInstance.current) {
            onSelectionChange({
                viewer: viewerInstance.current,
                ids: viewerInstance.current.getSelection()
            });
        }
    };

    return (
        <div ref={viewerDiv} style={{ width: '100%', height: '100%' }} />
    );
});


export default Viewer;
