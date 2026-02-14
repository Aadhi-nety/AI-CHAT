'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, ExternalLink, Filter, Search } from 'lucide-react';
import Link from 'next/link';
import { resourcesLibrary, getAllCategories, getResourcesByCategory } from '@/lib/resources-library';

export default function ResourcesPage() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredResources, setFilteredResources] = useState(resourcesLibrary);

  useEffect(() => {
    const email = localStorage.getItem('userId');
    if (!email) {
      window.location.href = '/';
      return;
    }
    setUserEmail(email);
  }, []);

  useEffect(() => {
    let filtered = resourcesLibrary;

    if (selectedCategory) {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredResources(filtered);
  }, [selectedCategory, searchQuery]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const categories = getAllCategories();
  const difficultyColors = {
    Beginner: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Intermediate: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Advanced: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Security Resources</h1>
            <p className="text-sm text-muted-foreground">AWS docs, OWASP guides, and security best practices</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{userEmail}</p>
            </div>
            <Button
              onClick={handleLogout}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30"
              variant="outline"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/40 border-border/50"
              />
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              <Link href="/labs">Back to Labs</Link>
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('')}
              className={selectedCategory === '' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-transparent border-border/50'}
            >
              All Resources
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'bg-blue-600 hover:bg-blue-700' : 'bg-transparent border-border/50'}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredResources.map((resource) => (
            <Card
              key={resource.id}
              className="border-border/50 bg-card/40 backdrop-blur hover:border-blue-500/50 hover:bg-card/80 transition-all duration-300 group overflow-hidden"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg group-hover:text-blue-400 transition-colors">
                      {resource.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                        {resource.category}
                      </span>
                      <span className={`px-2 py-1 rounded border text-xs font-semibold ${difficultyColors[resource.difficulty as keyof typeof difficultyColors]}`}>
                        {resource.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-muted-foreground">
                  {resource.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {resource.relatedLabs.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Related Labs:</p>
                      <div className="flex gap-2 flex-wrap">
                        {resource.relatedLabs.map(labId => (
                          <span key={labId} className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {labId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white"
                  >
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      Read More
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredResources.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No resources found matching your search.</p>
          </div>
        )}
      </main>
    </div>
  );
}
