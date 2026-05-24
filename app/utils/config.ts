const config = {
    refetchTime: 1000 * 30,
    refetch: true,
    lang: 'en',
    defaults: {
        forum: {
            allowForumLinks: false,
            allowForumImages: false,
            safeMode: true,
        }
    }
} as {
    refetchTime: number,
    refetch: boolean,
    lang: 'nl' | 'en',
    // this is configerable by the admins in the settings
    defaults: {
        forum: {
            allowForumLinks: boolean,
            allowForumImages: boolean,
            safeMode: boolean,
        }
    }
}

export default config;