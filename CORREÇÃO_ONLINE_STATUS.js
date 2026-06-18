// CORREÇÃO: Substituir o useEffect de autenticação no page.js (linhas 39-97)
// Este código usa onSnapshot em vez de getDoc para escutar mudanças em tempo real

useEffect(() => {
    let unsubscribeUser = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, listen to user document changes in real-time
            try {
                const userDocRef = doc(db, 'users', user.uid);

                // Use onSnapshot for real-time updates
                unsubscribeUser = onSnapshot(userDocRef, (userDoc) => {
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setCurrentUser({
                            uid: user.uid,
                            email: user.email,
                            name: userData.name || user.displayName || 'Usuário',
                            role: userData.role || 'user',
                            isOnline: userData.isOnline, // ← CAMPO CRÍTICO
                            department: userData.department,
                            departmentName: userData.departmentName,
                        });
                    } else {
                        // User doc doesn't exist, create it
                        console.warn("User document not found, creating default profile");
                        const defaultUserData = {
                            uid: user.uid,
                            name: user.displayName || 'Usuário',
                            email: user.email,
                            role: 'colaborador',
                            isOnline: false, // ← INICIALIZA COMO FALSE
                            createdAt: new Date().toISOString()
                        };

                        setDoc(userDocRef, defaultUserData);

                        setCurrentUser({
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName || 'Usuário',
                            role: 'colaborador',
                            isOnline: false,
                        });
                    }
                    setAuthLoading(false);
                }, (error) => {
                    console.error("Error listening to user document:", error);
                    setAuthLoading(false);
                });
            } catch (error) {
                console.error("Error setting up user listener:", error);
                setAuthLoading(false);
            }
        } else {
            setCurrentUser(null);
            setTickets([]);
            setAuthLoading(false);
        }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeUser) unsubscribeUser();
    };
}, []);
